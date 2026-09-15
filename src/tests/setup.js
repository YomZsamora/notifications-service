require('dotenv').config();
const { Client } = require('pg');
const { execSync } = require('child_process');

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
    const result = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (result.rowCount === 0) {
        await client.query(`CREATE DATABASE "${dbName}"`);
    }
    await client.end();

    execSync('npx sequelize-cli db:migrate', {
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: 'inherit',
    });
};
