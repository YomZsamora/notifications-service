const ERROR_STATUS = "error";
const SUCCESS_STATUS = "success";

class ApiResponse {

    constructor() {
        this.status = SUCCESS_STATUS;
        this.message = "";
        this.data = null;
    }
}

module.exports = { ApiResponse, ERROR_STATUS, SUCCESS_STATUS };
