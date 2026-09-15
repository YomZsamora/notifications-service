const qrcode = require('qrcode');
const sender = require('../../email/sender');
const config = require('../../configs/config');
const renderer = require('../../email/renderer');
const logger = require('pino')({ level: config.app.LOG_LEVEL });
const notificationRepository = require('../../repositories/notification-repository');

const handle = async (payload, log) => {

    let attachments = [];

    try {
        const qrBuffer = await qrcode.toBuffer(payload.ticketCode);
        attachments = [{
            filename: 'ticket-qr.png',
            content: qrBuffer,
            contentType: 'image/png',
            cid: 'ticket-qr',
        }];
    } catch (qrErr) {
        logger.warn(
            { eventId: log.eventId, error: qrErr.message },
            'QR code generation failed — sending email without attachment'
        );
    }

    const html = renderer.render('ticket-confirmation', {
        recipientName: payload.userName,
        eventName: payload.eventName,
        ticketCode: payload.ticketCode,
        eventDate: new Date(payload.eventDate).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        }),
        eventVenue: payload.eventVenue,
        appName: config.app.APP_NAME,
        appUrl: config.app.APP_URL,
    });

    const info = await sender.sendEmail({
        to: payload.userEmail,
        subject: `Your ticket for ${payload.eventName} — ${payload.ticketCode}`,
        html,
        attachments,
    });

    logger.info({ eventId: log.eventId, eventType: log.eventType, messageId: info.messageId }, 'Email delivered');

    try {
        await notificationRepository.updateLog(log.id, { status: 'sent', processedAt: new Date() });
    } catch (dbErr) {
        logger.error({ eventId: log.eventId, error: dbErr.message }, 'Failed to update notification log — email was delivered');
    }
};

module.exports = { handle };
