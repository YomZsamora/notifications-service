'use strict';

class BadRequest extends Error {
    constructor(message, errors = null) {
        super(message);
        this.name = 'BadRequest';
        this.errors = errors;
        this.statusCode = 400;
    }
}

class NotFound extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFound';
        this.statusCode = 404;
    }
}

class Conflict extends Error {
    constructor(message) {
        super(message);
        this.name = 'Conflict';
        this.statusCode = 409;
    }
}

class NotAuthenticated extends Error {
    constructor() {
        super('Authentication credentials were not provided.');
        this.statusCode = 401;
        this.name = 'NotAuthenticated';
    }
}

class PermissionDenied extends Error {
    constructor() {
        super("You don't have required permission to perform this action.");
        this.statusCode = 403;
        this.name = 'PermissionDenied';
    }
}

class TokenExpired extends Error {
    constructor() {
        super('Token has expired.');
        this.statusCode = 401;
        this.name = 'TokenExpired';
    }
}

class InvalidJsonWebToken extends Error {
    constructor() {
        super('Provided token is invalid.');
        this.statusCode = 401;
        this.name = 'InvalidJsonWebToken';
    }
}

class TokenReuseDetected extends Error {
    constructor() {
        super('Token reuse detected. All sessions have been revoked.');
        this.statusCode = 401;
        this.name = 'TokenReuseDetected';
    }
}

module.exports = {
    BadRequest,
    NotFound,
    Conflict,
    NotAuthenticated,
    PermissionDenied,
    TokenExpired,
    InvalidJsonWebToken,
    TokenReuseDetected,
};
