const { validate: isUuid } = require('uuid');
const config = require('../../configs/config');
const { getChannel, getConnection } = require('../../configs/rabbitmq');
const sequelize = require('../../configs/sequelize');
const notificationRepository = require('../../repositories/notification-repository');
const notificationSerializer = require('../../utils/serializers/notification-serializer');
const { ApiResponse } = require('../../utils/responses');
const { NotFound, Conflict, BadRequest } = require('../../utils/exceptions/custom-exceptions');

const mapLogToPayload = (log) => {
    switch (log.eventType) {
        case 'user.registered':
            return { email: log.recipientEmail, name: log.recipientName };
        case 'user.followed':
            return { followedUserEmail: log.recipientEmail, followedUserName: log.recipientName };
        case 'post.liked':
            return { postAuthorEmail: log.recipientEmail, postAuthorName: log.recipientName };
        case 'post.commented':
            return { postAuthorEmail: log.recipientEmail, postAuthorName: log.recipientName };
        case 'event.ticket_purchased':
            return { userEmail: log.recipientEmail, userName: log.recipientName };
        default:
            return {};
    }
};

const list = async (req, res, next) => {
    try {
        const { status, eventType, startDate, endDate } = req.query;
        const page = parseInt(req.query.page) || config.app.DEFAULT_PAGE;
        const pageSize = parseInt(req.query.pageSize) || config.app.DEFAULT_PAGE_SIZE;

        const result = await notificationRepository.findAllLogs({
            status, eventType, startDate, endDate, page, pageSize,
        });

        const response = new ApiResponse(200, 'Notifications retrieved successfully');
        response.data = {
            notifications: notificationSerializer.serializeNotificationList(result.rows),
            total: result.count,
            page,
            pageSize,
        };
        res.status(response.statusCode).json(response);
    } catch (err) {
        next(err);
    }
};

const getStats = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const stats = await notificationRepository.getStats({ startDate, endDate });

        const response = new ApiResponse(200, 'Notification stats retrieved successfully');
        response.data = stats;
        res.status(response.statusCode).json(response);
    } catch (err) {
        next(err);
    }
};

const getOne = async (req, res, next) => {
    try {
        const { eventId } = req.params;
        if (!isUuid(eventId)) return next(new BadRequest('eventId must be a valid UUID v4.'));

        const log = await notificationRepository.findLogByEventId(eventId);
        if (!log) return next(new NotFound(`No notification found for eventId: ${eventId}`));

        const response = new ApiResponse(200, 'Notification retrieved successfully');
        response.data = { notification: notificationSerializer.serializeNotification(log) };
        res.status(response.statusCode).json(response);
    } catch (err) {
        next(err);
    }
};

const replay = async (req, res, next) => {
    try {
        const { eventId } = req.params;
        if (!isUuid(eventId)) return next(new BadRequest('eventId must be a valid UUID v4.'));

        const log = await notificationRepository.findLogByEventId(eventId);
        if (!log) return next(new NotFound(`No notification found for eventId: ${eventId}`));
        if (log.status !== 'failed') {
            return next(new Conflict(`Cannot replay a notification with status '${log.status}'. Only failed notifications can be replayed.`));
        }

        const channel = getChannel();
        const message = Buffer.from(JSON.stringify({
            eventId: log.eventId,
            eventType: log.eventType,
            timestamp: new Date().toISOString(),
            payload: mapLogToPayload(log),
        }));

        channel.publish(config.app.EXCHANGE_NAME, log.eventType, message, { persistent: true });

        const response = new ApiResponse(200, 'Notification queued for replay');
        response.data = { eventId: log.eventId, eventType: log.eventType };
        res.status(response.statusCode).json(response);
    } catch (err) {
        next(err);
    }
};

const health = async (req, res, next) => {
    try {
        let dbStatus = 'connected';
        let amqpStatus = 'connected';

        try {
            await sequelize.authenticate();
        } catch {
            dbStatus = 'disconnected';
        }

        if (!getConnection()) amqpStatus = 'disconnected';

        const response = new ApiResponse(200, 'Service is running');
        response.data = { db: dbStatus, amqp: amqpStatus };
        res.status(response.statusCode).json(response);
    } catch (err) {
        next(err);
    }
};

module.exports = { list, getStats, getOne, replay, health };
