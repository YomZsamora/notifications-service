'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('notification_log', 'payload', {
            type: Sequelize.JSONB,
            allowNull: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('notification_log', 'payload');
    },
};
