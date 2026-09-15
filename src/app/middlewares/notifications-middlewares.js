const { handleBadRequests } = require('../../utils/exceptions/exception-handler');
const {
    statusQueryValidator,
    eventTypeQueryValidator,
    startDateQueryValidator,
    endDateQueryValidator,
    pageQueryValidator,
    pageSizeQueryValidator,
} = require('../../utils/validators/notification-validators');

const listNotificationsMiddlewares = [
    statusQueryValidator,
    eventTypeQueryValidator,
    startDateQueryValidator,
    endDateQueryValidator,
    pageQueryValidator,
    pageSizeQueryValidator,
    handleBadRequests('Invalid query parameters.'),
];

const getStatsMiddlewares = [
    startDateQueryValidator,
    endDateQueryValidator,
    handleBadRequests('Invalid query parameters.'),
];

module.exports = { listNotificationsMiddlewares, getStatsMiddlewares };
