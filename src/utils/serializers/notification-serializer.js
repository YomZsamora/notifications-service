const serializeNotification = (log) => ({
    id: log.id,
    eventId: log.eventId,
    eventType: log.eventType,
    recipientEmail: log.recipientEmail,
    recipientName: log.recipientName,
    status: log.status,
    failureReason: log.failureReason,
    retryCount: log.retryCount,
    processedAt: log.processedAt,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
});

const serializeNotificationList = (logs) => logs.map(serializeNotification);

module.exports = { serializeNotification, serializeNotificationList };
