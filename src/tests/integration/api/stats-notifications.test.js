const request = require('supertest');
const { faker } = require('@faker-js/faker');
const app = require('../../../app');
const { NotificationLog } = require('../../../models/notification-log');
const { getStats } = require('../../../app/controllers/notifications-controller');

describe('GET /api/v1/notifications/stats', () => {
    let seededLogs = [];

    beforeAll(async () => {
        seededLogs = await NotificationLog.bulkCreate([
            {
                eventId: faker.string.uuid(),
                eventType: 'user.registered',
                recipientEmail: faker.internet.email(),
                recipientName: faker.person.firstName(),
                status: 'sent',
                processedAt: new Date(),
            },
            {
                eventId: faker.string.uuid(),
                eventType: 'post.liked',
                recipientEmail: faker.internet.email(),
                recipientName: faker.person.firstName(),
                status: 'failed',
                failureReason: 'SMTP error',
            },
        ]);
    });

    afterAll(async () => {
        await NotificationLog.destroy({ where: { id: seededLogs.map((l) => l.id) } });
    });

    it('returns 200 with byStatus and byEventType arrays', async () => {
        const res = await request(app).get('/api/v1/notifications/stats');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toMatchObject({
            byStatus: expect.any(Array),
            byEventType: expect.any(Array),
        });
        const statusEntry = res.body.data.byStatus[0];
        expect(statusEntry).toHaveProperty('status');
        expect(statusEntry).toHaveProperty('count');
        const typeEntry = res.body.data.byEventType[0];
        expect(typeEntry).toHaveProperty('eventType');
        expect(typeEntry).toHaveProperty('count');
    });

    it('returns 400 for an invalid startDate format', async () => {
        const res = await request(app).get('/api/v1/notifications/stats?startDate=not-a-date');
        expect(res.status).toBe(400);
    });
});
