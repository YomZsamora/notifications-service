const { validate: isUuid } = require('uuid');
const config = require('../../configs/config');
const { getChannel, getConnection } = require('../../configs/rabbitmq');
const sequelize = require('../../configs/sequelize');
const notificationRepository = require('../../repositories/notification-repository');
const notificationSerializer = require('../../utils/serializers/notification-serializer');
const { ApiResponse } = require('../../utils/responses');
const { NotFound, Conflict, BadRequest } = require('../../utils/exceptions/custom-exceptions');


const list = async (req, res) => {
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
};

const getStats = async (req, res) => {
    const { startDate, endDate } = req.query;
    const stats = await notificationRepository.getStats({ startDate, endDate });
    const response = new ApiResponse(200, 'Notification stats retrieved successfully');
    response.data = stats;
    res.status(response.statusCode).json(response);
};

const getOne = async (req, res) => {
    const { eventId } = req.params;
    if (!isUuid(eventId)) throw new BadRequest('eventId must be a valid UUID v4.');
    const log = await notificationRepository.findLogByEventId(eventId);
    if (!log) throw new NotFound(`No notification found for eventId: ${eventId}`);
    const response = new ApiResponse(200, 'Notification retrieved successfully');
    response.data = { notification: notificationSerializer.serializeNotification(log) };
    res.status(response.statusCode).json(response);
};

const replay = async (req, res) => {
    const { eventId } = req.params;
    if (!isUuid(eventId)) throw new BadRequest('eventId must be a valid UUID v4.');
    const log = await notificationRepository.findLogByEventId(eventId);
    if (!log) throw new NotFound(`No notification found for eventId: ${eventId}`);
    if (log.status !== 'failed') {
        throw new Conflict(`Cannot replay a notification with status '${log.status}'. Only failed notifications can be replayed.`);
    }
    if (!log.payload) throw new BadRequest('Cannot replay: original event payload was not stored.');
    const channel = getChannel();
    const message = Buffer.from(JSON.stringify({
        eventId: log.eventId,
        eventType: log.eventType,
        timestamp: new Date().toISOString(),
        payload: log.payload,
    }));
    channel.publish(config.app.EXCHANGE_NAME, log.eventType, message, { persistent: true });
    const response = new ApiResponse(200, 'Notification queued for replay');
    response.data = { eventId: log.eventId, eventType: log.eventType };
    res.status(response.statusCode).json(response);
};

const health = async (req, res) => {
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
};

module.exports = { list, getStats, getOne, replay, health };
