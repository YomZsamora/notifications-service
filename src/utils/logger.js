const pino = require('pino');
const config = require('../configs/config');

const logger = pino({ level: config.app.LOG_LEVEL });

module.exports = logger;
