const request = require('supertest');
const app = require('../../../app');

describe('GET /health', () => {
    it('returns 200 with db and amqp status fields', async () => {
        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toMatchObject({
            db: expect.stringMatching(/^(connected|disconnected)$/),
            amqp: expect.stringMatching(/^(connected|disconnected)$/),
        });
    });

    it('reports db as connected when the test database is reachable', async () => {
        const res = await request(app).get('/health');

        expect(res.body.data.db).toBe('connected');
    });

    it('reports amqp as disconnected when no broker connection exists', async () => {
        const res = await request(app).get('/health');

        expect(res.body.data.amqp).toBe('disconnected');
    });
});
