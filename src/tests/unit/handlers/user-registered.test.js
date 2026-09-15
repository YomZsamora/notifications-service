jest.mock('../../../email/sender');
jest.mock('../../../email/renderer');
jest.mock('../../../repositories/notification-repository');

const sender = require('../../../email/sender');
const renderer = require('../../../email/renderer');
const notificationRepository = require('../../../repositories/notification-repository');
const { handle } = require('../../../consumer/handlers/user-registered');

const mockPayload = {
    email: 'alice@example.com',
    name: 'Alice',
};

const mockLog = {
    id: 'log-id-1',
    eventId: 'event-id-1',
    eventType: 'user.registered',
};

beforeEach(() => {
    jest.clearAllMocks();
    renderer.render.mockReturnValue('<html>welcome</html>');
    sender.sendEmail.mockResolvedValue({ messageId: 'msg-001' });
    notificationRepository.updateLog.mockResolvedValue();
});

describe('user-registered handler', () => {
    it('calls renderer with the welcome template and correct context', async () => {
        await handle(mockPayload, mockLog);

        expect(renderer.render).toHaveBeenCalledWith('welcome', expect.objectContaining({
            name: mockPayload.name,
        }));
    });

    it('calls sender with the correct recipient, subject, and html', async () => {
        await handle(mockPayload, mockLog);

        expect(sender.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: mockPayload.email,
            subject: expect.stringContaining(mockPayload.name),
            html: '<html>welcome</html>',
        }));
    });

    it('updates the log to sent after successful delivery', async () => {
        await handle(mockPayload, mockLog);

        expect(notificationRepository.updateLog).toHaveBeenCalledWith(
            mockLog.id,
            expect.objectContaining({ status: 'sent' })
        );
    });

    it('propagates errors thrown by sender', async () => {
        sender.sendEmail.mockRejectedValue(new Error('SMTP timeout'));

        await expect(handle(mockPayload, mockLog)).rejects.toThrow('SMTP timeout');
    });

    it('does not propagate errors thrown by updateLog after delivery', async () => {
        notificationRepository.updateLog.mockRejectedValue(new Error('DB connection lost'));

        await expect(handle(mockPayload, mockLog)).resolves.not.toThrow();
    });
});
