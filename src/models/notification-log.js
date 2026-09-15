const { DataTypes } = require('sequelize');
const sequelize = require('../configs/sequelize');

const NotificationLog = sequelize.define('NotificationLog', {

    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    eventId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
    },
    eventType: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    recipientEmail: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    recipientName: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('pending', 'sent', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
    },
    failureReason: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    retryCount: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
    },
    processedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'notification_logs',
    indexes: [
        { name: 'idx_notification_log_eventId', fields: ['eventId'], unique: true },
        { name: 'idx_notification_log_status', fields: ['status'] },
        { name: 'idx_notification_log_eventType', fields: ['eventType'] },
    ],
});

module.exports = { NotificationLog };