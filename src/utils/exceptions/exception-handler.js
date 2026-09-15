const config = require('../../configs/config');
const { BadRequest } = require('./custom-exceptions');
const { validationResult } = require('express-validator');
const logger = require('pino')({ level: config.app.LOG_LEVEL });

const handleBadRequests = (errorMessage) => (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new BadRequest(errorMessage || errors.array()[0].msg));
    }
    next();
};

const exceptionHandler = (err, req, res, next) => {

    const statusCode = err.statusCode || 500;
    const isOperational = err.isOperational || false;

    if (isOperational) {
        logger.warn({ statusCode, error: err.message, path: req.path }, 'Operational error');
    } else {
        logger.error({ statusCode, error: err.message, stack: err.stack, path: req.path }, 'Unexpected error');
    }

    res.status(statusCode).json({
        status: 'error',
        message: isOperational ? err.message : 'An unexpected error occurred',
        data: null,
    });
};

module.exports = { handleBadRequests, exceptionHandler };
