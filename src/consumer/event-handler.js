const config = require('../configs/config');
const { validate: isUuid } = require('uuid');
const logger = require('pino')({ level: config.app.LOG_LEVEL });
const notificationRepository = require('../repositories/notification-repository');

const handlers = {
    'user.registered': require('./handlers/user-registered'),
    'user.followed': require('./handlers/user-followed'),
    'post.liked': require('./handlers/post-liked'),
    'post.commented': require('./handlers/post-commented'),
    'event.ticket_purchased': require('./handlers/ticket-purchased'),
};

const KNOWN_EVENT_TYPES = Object.keys(handlers);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getRecipient = (eventType, payload) => {
    switch (eventType) {
        case 'user.registered':
            return { email: payload.email, name: payload.name };
        case 'user.followed':
            return { email: payload.followedUserEmail, name: payload.followedUserName };
        case 'post.liked':
            return { email: payload.postAuthorEmail, name: payload.postAuthorName };
        case 'post.commented':
            return { email: payload.postAuthorEmail, name: payload.postAuthorName };
        case 'event.ticket_purchased':
            return { email: payload.userEmail, name: payload.userName };
        default:
            return { email: null, name: null };
    }
};

const validate = (envelope) => {
    const { eventId, eventType, timestamp, payload } = envelope;
    if (!eventId || !isUuid(eventId)) return 'eventId must be a valid UUID v4';
    if (!eventType || !KNOWN_EVENT_TYPES.includes(eventType))
        return `eventType must be one of: ${KNOWN_EVENT_TYPES.join(', ')}`;
    if (!timestamp || isNaN(new Date(timestamp).getTime()))
        return 'timestamp must be a valid ISO 8601 datetime';
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        return 'payload must be an object';
    const { email } = getRecipient(eventType, payload);
    if (!email || !EMAIL_REGEX.test(email)) return 'payload recipient email is missing or invalid';
    return null;
};

const eventHandler = async (channel, msg) => {
    
    if (!msg) return;

    // Step 1 — Parse
    let envelope;
    try {
        envelope = JSON.parse(msg.content.toString());
    } catch {
        logger.error('Failed to parse message — routing to DLQ');
        channel.nack(msg, false, false);
        return;
    }

    // Step 2 — Validate
    const validationError = validate(envelope);
    if (validationError) {
        logger.error({ error: validationError }, 'Invalid message envelope — routing to DLQ');
        channel.nack(msg, false, false);
        return;
    }

    const { eventId, eventType, payload } = envelope;
    const retryCount = (msg.properties.headers && msg.properties.headers['x-retry-count']) || 0;
    const { email: recipientEmail, name: recipientName } = getRecipient(eventType, payload);

    // Step 3 — Idempotency Check + Retry Awareness
    let log;
    try {
        const existing = await notificationRepository.findLogByEventId(eventId); // Idempotency check
        if (existing) {
            if (retryCount === 0) {
                logger.warn({ eventId }, 'Duplicate event received — skipping');
                channel.ack(msg);
                return;
            }
            log = existing;
            await notificationRepository.updateLog(log.id, { retryCount });
        } else {
            log = await notificationRepository.createLog({
                eventId, eventType, recipientEmail, recipientName, status: 'pending',
            });
        }
    } catch (dbErr) {
        logger.error({ eventId, eventType, error: dbErr.message }, 'DB error before processing — routing to DLQ');
        channel.nack(msg, false, false);
        return;
    }

    // Step 4 — Route to Handler and Ack
    try {
        await handlers[eventType].handle(payload, log);
        channel.ack(msg);
        logger.info({ eventId, eventType, recipientEmail }, 'Message processed successfully');
    } catch (err) {
        // Step 5 — Retry / DLQ
        logger.warn({ eventId, eventType, retryCount, error: err.message }, 'Email delivery failed');

        if (retryCount >= config.app.MAX_RETRIES) {
            logger.error({ eventId, eventType, retryCount }, 'Max retries exceeded — routing to DLQ');
            try {
                await notificationRepository.updateLog(log.id, { status: 'failed', failureReason: err.message });
            } catch (dbErr) {
                logger.error({ eventId, error: dbErr.message }, 'Failed to update log to failed status');
            }
            channel.nack(msg, false, false);
        } else {
            logger.info({ eventId, eventType, nextRetry: retryCount + 1 }, 'Retrying message');
            channel.publish(
                config.app.EXCHANGE_NAME,
                msg.fields.routingKey,
                msg.content,
                {
                    ...msg.properties,
                    headers: { ...msg.properties.headers, 'x-retry-count': retryCount + 1 },
                    expiration: String(config.app.RETRY_DELAY_MS * (retryCount + 1)),
                }
            );
            channel.ack(msg);
        }
    }
};

module.exports = eventHandler;
