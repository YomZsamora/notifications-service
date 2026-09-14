'use strict';

const { validationResult } = require('express-validator');
const { ApiResponse, ERROR_STATUS } = require('../responses');
const {
    BadRequest,
    NotFound,
    Conflict,
    NotAuthenticated,
    PermissionDenied,
    TokenExpired,
    InvalidJsonWebToken,
    TokenReuseDetected,
} = require('./custom-exceptions');

const exceptionHandler = (err, req, res, _next) => {
    const apiResponse = new ApiResponse();
    apiResponse.status = ERROR_STATUS;
    apiResponse.message = err.message || 'Internal Server Error';
    apiResponse.data = err.errors || {};
    let statusCode = err.statusCode || 500;

    if (err instanceof BadRequest) {
        statusCode = err.statusCode;
        apiResponse.message = err.message;
        apiResponse.data = err.errors;
    }

    if (err instanceof NotFound) {
        statusCode = err.statusCode;
        apiResponse.message = err.message;
    }

    if (err instanceof Conflict) {
        statusCode = err.statusCode;
        apiResponse.message = err.message;
    }

    if (err instanceof NotAuthenticated) {
        statusCode = err.statusCode;
        apiResponse.message = err.message;
    }

    if (err instanceof PermissionDenied) {
        statusCode = err.statusCode;
        apiResponse.message = err.message;
    }

    if (err instanceof TokenExpired) {
        statusCode = err.statusCode;
        apiResponse.message = err.message;
    }

    if (err instanceof InvalidJsonWebToken) {
        statusCode = err.statusCode;
        apiResponse.message = err.message;
    }

    if (err instanceof TokenReuseDetected) {
        statusCode = err.statusCode;
        apiResponse.message = err.message;
    }

    return res.status(statusCode).json(apiResponse);
};

const formatExceptions = (errors) => {
    return Object.fromEntries(
        Object.entries(errors.mapped()).map(([field, error]) => [field, error.msg])
    );
};

const handleBadRequests = (errorMessage = 'Validation failed.') => {
    return (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new BadRequest(errorMessage, formatExceptions(errors));
        }
        next();
    };
};

module.exports = {
    exceptionHandler,
    formatExceptions,
    handleBadRequests,
};
