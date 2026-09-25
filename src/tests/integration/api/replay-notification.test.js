jest.mock('../../../configs/rabbitmq', () => ({
    connect: jest.fn(),
    getChannel: jest.fn(),
    getConnection: jest.fn(),
}));

const request = require('supertest');
const { faker } = require('@faker-js/faker');
const app = require('../../../app');
const { NotificationLog } = require('../../../models/notification-log');
const { getChannel } = require('../../../configs/rabbitmq');

const mockChannel = { publish: jest.fn() };

describe('POST /api/v1/notifications/replay/:eventId', () => {
    let failedLog;
    let sentLog;

    beforeAll(async () => {
        getChannel.mockReturnValue(mockChannel);

        [failedLog, sentLog] = await NotificationLog.bulkCreate([
            {
                eventId: faker.string.uuid(),
                eventType: 'user.registered',
                recipientEmail: faker.internet.email(),
                recipientName: faker.person.firstName(),
                status: 'failed',
                failureReason: 'SMTP timeout',
                payload: { email: faker.internet.email(), name: faker.person.firstName() },
            },
            {
                eventId: faker.string.uuid(),
                eventType: 'post.liked',
                recipientEmail: faker.internet.email(),
                recipientName: faker.person.firstName(),
                status: 'sent',
                processedAt: new Date(),
            },
        ]);
    });

    afterAll(async () => {
        await NotificationLog.destroy({ where: { id: [failedLog.id, sentLog.id] } });
    });

    it('returns 200 and publishes the message for a failed notification', async () => {
        const res = await request(app).post(`/api/v1/notifications/replay/${failedLog.eventId}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toMatchObject({
            eventId: failedLog.eventId,
            eventType: failedLog.eventType,
        });
        expect(mockChannel.publish).toHaveBeenCalled();
    });

    it('returns 409 for a notification that is not failed', async () => {
        const res = await request(app).post(`/api/v1/notifications/replay/${sentLog.eventId}`);
        expect(res.status).toBe(409);
    });

    it('returns 404 for a valid UUID that does not exist', async () => {
        const res = await request(app).post(`/api/v1/notifications/replay/${faker.string.uuid()}`);
        expect(res.status).toBe(404);
    });

    it('returns 400 for a string that is not a valid UUID', async () => {
        const res = await request(app).post('/api/v1/notifications/replay/not-a-uuid');
        expect(res.status).toBe(400);
    });
});
