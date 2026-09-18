const sender = require('../../email/sender');
const config = require('../../configs/config');
const renderer = require('../../email/renderer');
const logger = require('../../configs/logger');
const notificationRepository = require('../../repositories/notification-repository');

const handle = async (payload, log) => {

    const html = renderer.render('post-liked', {
        recipientName: payload.postAuthorName,
        likerName: payload.likerName,
        postTitle: payload.postTitle,
        appName: config.app.APP_NAME,
        appUrl: config.app.APP_URL,
    });

    const info = await sender.sendEmail({
        to: payload.postAuthorEmail,
        subject: `${payload.likerName} liked your post`,
        html,
    });

    logger.info({ eventId: log.eventId, eventType: log.eventType, messageId: info.messageId }, 'Email delivered');

    try {
        await notificationRepository.updateLog(log.id, { status: 'sent', processedAt: new Date() });
    } catch (dbErr) {
        logger.error({ eventId: log.eventId, error: dbErr.message }, 'Failed to update notification log — email was delivered');
    }
};

module.exports = { handle };
