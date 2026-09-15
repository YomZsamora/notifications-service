'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('notification_log', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false,
            },
            eventId: {
                type: Sequelize.UUID,
                allowNull: false,
            },
            eventType: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            recipientEmail: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            recipientName: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            status: {
                type: Sequelize.ENUM('pending', 'sent', 'failed'),
                allowNull: false,
                defaultValue: 'pending',
            },
            failureReason: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            retryCount: {
                type: Sequelize.SMALLINT,
                allowNull: false,
                defaultValue: 0,
            },
            processedAt: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await queryInterface.addIndex('notification_log', ['eventId'], {
            unique: true,
            name: 'idx_notification_log_eventId',
        });
        await queryInterface.addIndex('notification_log', ['status'], {
            name: 'idx_notification_log_status',
        });
        await queryInterface.addIndex('notification_log', ['eventType'], {
            name: 'idx_notification_log_eventType',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('notification_log');
        await queryInterface.sequelize.query(
            'DROP TYPE IF EXISTS "enum_notification_log_status";'
        );
    },
};