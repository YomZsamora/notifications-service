require('dotenv').config();
const { Sequelize } = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('../configs/config')[env];

if (!config) throw new Error(`No configuration found for environment: ${env}`);
if (!config.database || !config.username || !config.password || !config.host) throw new Error(`Missing required database configuration for environment: ${env}`);

const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
        host: config.host,
        dialect: config.dialect,
    }
);

sequelize.authenticate()
    .then(() => console.log('Database has been connected successfully.'))
    .catch((err) => console.log('Error: ' + err));

module.exports = sequelize;