require('dotenv').config();
const express = require('express');
const config = require('./configs/config');
const { connect } = require('./configs/rabbitmq');
const logger = require('pino')({ level: config.app.LOG_LEVEL });
const notificationsRouter = require('./app/routes/notifications-routes');
const { health } = require('./app/controllers/notifications-controller');
const { exceptionHandler } = require('./utils/exceptions/exception-handler');

const app = express();

app.use(express.json());

app.get('/health', health);
app.use('/api/v1/notifications', notificationsRouter);

app.use(exceptionHandler);

const start = async () => {
    
    await connect();

    const server = app.listen(config.app.PORT, () => {
        logger.info({ port: config.app.PORT }, 'HTTP API started');
    });

    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received — shutting down gracefully');
        server.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
        });
    });
};

start().catch((err) => {
    logger.fatal({ error: err.message }, 'HTTP API failed to start — exiting');
    process.exit(1);
});
