const { Sequelize } = require('sequelize');
const config = require('./config');

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

module.exports = sequelize;
