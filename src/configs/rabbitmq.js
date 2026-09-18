const amqp = require('amqplib');
const config = require('./config');
const logger = require('./logger');

let connection = null;
let channel = null;

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

const assertTopology = async (ch) => {
    await ch.assertExchange(config.app.EXCHANGE_NAME, 'topic', { durable: true });
    await ch.assertExchange(config.app.DLX_NAME, 'fanout', { durable: true });
    await ch.assertQueue(config.app.QUEUE_NAME, {
        durable: true,
        arguments: { 'x-dead-letter-exchange': config.app.DLX_NAME }, // When any message dies in this queue, route it to DLX_NAME instead of dropping it
    });

    await ch.assertQueue(config.app.DLQ_NAME, { durable: true });
    await ch.bindQueue(config.app.DLQ_NAME, config.app.DLX_NAME, '');

    // These three bindings tell EXCHANGE_NAME which messages to route to QUEUE_NAME
    await ch.bindQueue(config.app.QUEUE_NAME, config.app.EXCHANGE_NAME, 'user.#');
    await ch.bindQueue(config.app.QUEUE_NAME, config.app.EXCHANGE_NAME, 'post.#');
    await ch.bindQueue(config.app.QUEUE_NAME, config.app.EXCHANGE_NAME, 'event.#');

    logger.info('RabbitMQ topology asserted');
};

const connect = async (attempt = 0) => {
    try {
        connection = await amqp.connect(config.app.AMQP_URL);
        channel = await connection.createChannel();
        await assertTopology(channel);

        logger.info('Connected to RabbitMQ');

        connection.on('error', (err) => {
            logger.error({ error: err.message }, 'RabbitMQ connection error');
        });

        connection.on('close', () => {
            logger.warn('RabbitMQ connection closed — reconnecting');
            connection = null;
            channel = null;
            connect(0);
        });
    } catch (err) {
        logger.warn(
            { attempt: attempt + 1, error: err.message },
            'RabbitMQ connection attempt failed'
        );

        if (attempt >= RECONNECT_DELAYS_MS.length) {
            logger.fatal('Max reconnect attempts reached — exiting');
            process.exit(1);
        }

        const delay = RECONNECT_DELAYS_MS[attempt];
        logger.info({ delayMs: delay }, 'Retrying RabbitMQ connection');
        await new Promise((resolve) => setTimeout(resolve, delay));
        return connect(attempt + 1);
    }
};

const getChannel = () => channel;
const getConnection = () => connection;

module.exports = { connect, getChannel, getConnection };
