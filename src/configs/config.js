require('dotenv').config();

module.exports = {
    development: {
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DATABASE,
        host: process.env.POSTGRES_HOST,
        port: parseInt(process.env.POSTGRES_PORT) || 5432,
        dialect: 'postgres',
    },
    test: {
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DATABASE_TEST,
        host: process.env.POSTGRES_HOST,
        port: parseInt(process.env.POSTGRES_PORT) || 5432,
        dialect: 'postgres',
    },
    staging: {},
    production: {},

    app: {
        PORT: parseInt(process.env.PORT) || 3001,
        NODE_ENV: process.env.NODE_ENV || 'development',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',

        DEFAULT_PAGE: parseInt(process.env.DEFAULT_PAGE) || 1,
        DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE) || 10,

        AMQP_URL: process.env.AMQP_URL,
        EXCHANGE_NAME: process.env.EXCHANGE_NAME || 'app.events',
        QUEUE_NAME: process.env.QUEUE_NAME || 'notifications.queue',
        DLX_NAME: process.env.DLX_NAME || 'app.events.dlx',
        DLQ_NAME: process.env.DLQ_NAME || 'notifications.dlq',
        MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
        RETRY_DELAY_MS: parseInt(process.env.RETRY_DELAY_MS) || 5000,

        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: parseInt(process.env.SMTP_PORT) || 587,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS,
        EMAIL_FROM: process.env.EMAIL_FROM,

        APP_NAME: process.env.APP_NAME || 'NotificationsService',
        APP_URL: process.env.APP_URL || 'http://localhost:3001',
    },
};