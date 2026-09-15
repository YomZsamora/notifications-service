const express = require('express');
const notificationsRouter = require('./app/routes/notifications-routes');
const { health } = require('./app/controllers/notifications-controller');
const { exceptionHandler } = require('./utils/exceptions/exception-handler');

const app = express();

app.use(express.json());

app.get('/health', health);
app.use('/api/v1/notifications', notificationsRouter);

app.use(exceptionHandler);

module.exports = app;
