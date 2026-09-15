class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class BadRequest extends AppError {
    constructor(message = 'Bad Request') {
        super(message, 400);
    }
}

class NotFound extends AppError {
    constructor(message = 'Not Found') {
        super(message, 404);
    }
}

class Conflict extends AppError {
    constructor(message = 'Conflict') {
        super(message, 409);
    }
}

module.exports = { 
    AppError, 
    BadRequest, 
    NotFound, 
    Conflict 
};
