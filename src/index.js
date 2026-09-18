require('dotenv').config();
const config = require('./configs/config');
const { connect } = require('./configs/rabbitmq');
const logger = require('./configs/logger');
const app = require('./app');

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
