const { query } = require('express-validator');

const statusQueryValidator = query('status')
    .optional()
    .isIn(['pending', 'sent', 'failed'])
    .withMessage('Status must be one of: pending, sent, failed.');

const eventTypeQueryValidator = query('eventType')
    .optional()
    .isIn(['user.registered', 'user.followed', 'post.liked', 'post.commented', 'event.ticket_purchased'])
    .withMessage('Invalid event type.');

const startDateQueryValidator = query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date (e.g. 2026-01-01).');

const endDateQueryValidator = query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date (e.g. 2026-01-01).');

const pageQueryValidator = query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer.');

const pageSizeQueryValidator = query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('pageSize must be an integer between 1 and 100.');

module.exports = {
    statusQueryValidator,
    eventTypeQueryValidator,
    startDateQueryValidator,
    endDateQueryValidator,
    pageQueryValidator,
    pageSizeQueryValidator,
};
