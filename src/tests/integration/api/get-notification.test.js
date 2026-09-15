const request = require('supertest');
const { faker } = require('@faker-js/faker');
const app = require('../../../app');
const { NotificationLog } = require('../../../models/notification-log');
const { getOne } = require('../../../app/controllers/notifications-controller');

describe('GET /api/v1/notifications/:eventId', () => {
    let seededLog;

    beforeAll(async () => {
        seededLog = await NotificationLog.create({
            eventId: faker.string.uuid(),
            eventType: 'user.registered',
            recipientEmail: faker.internet.email(),
            recipientName: faker.person.firstName(),
            status: 'sent',
            processedAt: new Date(),
        });
    });

    afterAll(async () => {
        await NotificationLog.destroy({ where: { id: seededLog.id } });
    });

    it('returns 200 with the notification for a known eventId', async () => {
        const res = await request(app).get(`/api/v1/notifications/${seededLog.eventId}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.notification).toMatchObject({
            eventId: seededLog.eventId,
            eventType: seededLog.eventType,
            recipientEmail: seededLog.recipientEmail,
            status: 'sent',
        });
    });

    it('returns 404 for a valid UUID that does not exist', async () => {
        const res = await request(app).get(`/api/v1/notifications/${faker.string.uuid()}`);
        expect(res.status).toBe(404);
    });

    it('returns 400 for a string that is not a valid UUID', async () => {
        const res = await request(app).get('/api/v1/notifications/not-a-uuid');
        expect(res.status).toBe(400);
    });

    it('passes errors to next() when an exception is thrown', async () => {
        const mockNext = jest.fn();
        await getOne({}, {}, mockNext);
        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
});
