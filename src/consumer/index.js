require('dotenv').config();
const config = require('../configs/config');
const eventHandler = require('./event-handler');
const { loadTemplates } = require('../email/renderer');
const logger = require('pino')({ level: config.app.LOG_LEVEL });
const { connect, getChannel, getConnection } = require('../configs/rabbitmq');

const start = async () => {
    
    await connect();

    try {
        loadTemplates();
    } catch (err) {
        logger.fatal({ error: err.message }, 'Failed to load email templates — exiting');
        process.exit(1);
    }

    const channel = getChannel();
    const { consumerTag } = await channel.consume(
        config.app.QUEUE_NAME,
        (msg) => eventHandler(channel, msg),
        { noAck: false }
    );

    logger.info({ queue: config.app.QUEUE_NAME }, 'Consumer started');

    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received — shutting down gracefully');
        await channel.cancel(consumerTag);
        await channel.close();
        await getConnection()?.close();
        process.exit(0);
    });
};

start().catch((err) => {
    logger.fatal({ error: err.message }, 'Consumer failed to start — exiting');
    process.exit(1);
});
