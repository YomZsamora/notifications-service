const { Op } = require('sequelize');
const sequelize = require('../configs/sequelize');
const { NotificationLog } = require('../models/notification-log');

const findLogByEventId = async (eventId) => NotificationLog.findOne({ where: { eventId } });

const createLog = async (data) => NotificationLog.create(data);

const updateLog = async (id, updates) => {
    const [, [updated]] = await NotificationLog.update(updates, {
        where: { id },
        returning: true,
    });
    return updated || null;
};

const findAllLogs = async ({ 
    status, 
    eventType, 
    startDate, 
    endDate, 
    page, 
    pageSize 
}) => {

    const where = {};

    if (status) where.status = status;
    if (eventType) where.eventType = eventType;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    return NotificationLog.findAndCountAll({
        where,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [['createdAt', 'DESC']],
    });
};

const getStats = async ({ startDate, endDate }) => {
    const where = {};

    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const [byStatus, byEventType] = await Promise.all([
        NotificationLog.findAll({
            where,
            attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['status'],
            raw: true,
        }),
        NotificationLog.findAll({
            where,
            attributes: ['eventType', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['eventType'],
            raw: true,
        }),
    ]);

    return { byStatus, byEventType };
};

module.exports = {
    findLogByEventId,
    createLog,
    updateLog,
    findAllLogs,
    getStats,
};
