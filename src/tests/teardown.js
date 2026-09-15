require('dotenv').config();
const { Client } = require('pg');

module.exports = async () => {
    const client = new Client({
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT || 5432,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: 'postgres',
    });

    await client.connect();
    const dbName = process.env.POSTGRES_DATABASE_TEST;
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await client.end();
};