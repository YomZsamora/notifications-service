jest.mock('../../../email/sender');
jest.mock('../../../email/renderer');
jest.mock('../../../repositories/notification-repository');

const sender = require('../../../email/sender');
const renderer = require('../../../email/renderer');
const notificationRepository = require('../../../repositories/notification-repository');
const { handle } = require('../../../consumer/handlers/user-followed');

const mockPayload = {
    followedUserEmail: 'bob@example.com',
    followedUserName: 'Bob',
    followerName: 'Alice',
};

const mockLog = {
    id: 'log-id-2',
    eventId: 'event-id-2',
    eventType: 'user.followed',
};

beforeEach(() => {
    jest.clearAllMocks();
    renderer.render.mockReturnValue('<html>new-follower</html>');
    sender.sendEmail.mockResolvedValue({ messageId: 'msg-002' });
    notificationRepository.updateLog.mockResolvedValue();
});

describe('user-followed handler', () => {
    it('calls renderer with the new-follower template and correct context', async () => {
        await handle(mockPayload, mockLog);

        expect(renderer.render).toHaveBeenCalledWith('new-follower', expect.objectContaining({
            recipientName: mockPayload.followedUserName,
            followerName: mockPayload.followerName,
        }));
    });

    it('calls sender with the correct recipient, subject, and html', async () => {
        await handle(mockPayload, mockLog);

        expect(sender.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: mockPayload.followedUserEmail,
            subject: expect.stringContaining(mockPayload.followerName),
            html: '<html>new-follower</html>',
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
