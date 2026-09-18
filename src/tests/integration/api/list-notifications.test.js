const app = require('../../../app');
const request = require('supertest');
const { faker } = require('@faker-js/faker');
const { NotificationLog } = require('../../../models/notification-log');
const { list } = require('../../../app/controllers/notifications-controller');

describe('GET /api/v1/notifications', () => {

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
                eventType: 'user.followed',
                recipientEmail: faker.internet.email(),
                recipientName: faker.person.firstName(),
                status: 'failed',
                failureReason: 'SMTP error',
            },
            {
                eventId: faker.string.uuid(),
                eventType: 'post.liked',
                recipientEmail: faker.internet.email(),
                recipientName: faker.person.firstName(),
                status: 'pending',
            },
        ]);
    });

    afterAll(async () => {
        await NotificationLog.destroy({ where: { id: seededLogs.map((l) => l.id) } });
    });

    it('returns 200 with a paginated notification list', async () => {
        const res = await request(app).get('/api/v1/notifications');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toMatchObject({
            notifications: expect.any(Array),
            total: expect.any(Number),
            page: expect.any(Number),
            pageSize: expect.any(Number),
        });
    });

    it('filters by status', async () => {
        const res = await request(app).get('/api/v1/notifications?status=sent');
        expect(res.status).toBe(200);
        const statuses = res.body.data.notifications.map((n) => n.status);
        expect(statuses.every((s) => s === 'sent')).toBe(true);
    });

    it('filters by eventType', async () => {
        const res = await request(app).get('/api/v1/notifications?eventType=user.registered');
        expect(res.status).toBe(200);
        const types = res.body.data.notifications.map((n) => n.eventType);
        expect(types.every((t) => t === 'user.registered')).toBe(true);
    });

    it('respects pageSize', async () => {
        const res = await request(app).get('/api/v1/notifications?pageSize=1&page=1');
        expect(res.status).toBe(200);
        expect(res.body.data.notifications).toHaveLength(1);
        expect(res.body.data.pageSize).toBe(1);
    });

    it('returns 400 for an invalid status value', async () => {
        const res = await request(app).get('/api/v1/notifications?status=invalid');
        expect(res.status).toBe(400);
    });
});
