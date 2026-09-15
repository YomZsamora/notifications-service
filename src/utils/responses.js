class ApiResponse {

    constructor(statusCode, message, data = null) {
        this.statusCode = statusCode;
        this.status = 'success';
        this.message = message;
        this.data = data;
    }

    toJSON() {
        return {
            status: this.status,
            message: this.message,
            data: this.data,
        };
    }
}

module.exports = { ApiResponse };
