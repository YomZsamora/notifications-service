const { Sequelize } = require('sequelize');
const config = require('./config');
const logger = require('pino')({ level: config.app.LOG_LEVEL });

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

if (!dbConfig) throw new Error(`No database configuration found for environment: ${env}`);
if (!dbConfig.database || !dbConfig.username || !dbConfig.password || !dbConfig.host)
    throw new Error(`Missing required database configuration for environment: ${env}`);

const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
        host: dbConfig.host,
        dialect: dbConfig.dialect,
        logging: false,
    }
);

sequelize.authenticate()
    .then(() => logger.info('PostgreSQL connected successfully'))
    .catch((err) => logger.error({ error: err.message }, 'PostgreSQL connection failed'));

module.exports = sequelize;
