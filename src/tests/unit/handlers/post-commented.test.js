jest.mock('../../../email/sender');
jest.mock('../../../email/renderer');
jest.mock('../../../repositories/notification-repository');

const sender = require('../../../email/sender');
const renderer = require('../../../email/renderer');
const notificationRepository = require('../../../repositories/notification-repository');
const { handle } = require('../../../consumer/handlers/post-commented');

const mockPayload = {
    postAuthorEmail: 'carol@example.com',
    postAuthorName: 'Carol',
    commenterName: 'Bob',
    commentText: 'Great post!',
    postTitle: 'My First Post',
};

const mockLog = {
    id: 'log-id-4',
    eventId: 'event-id-4',
    eventType: 'post.commented',
};

beforeEach(() => {
    jest.clearAllMocks();
    renderer.render.mockReturnValue('<html>post-commented</html>');
    sender.sendEmail.mockResolvedValue({ messageId: 'msg-004' });
    notificationRepository.updateLog.mockResolvedValue();
});

describe('post-commented handler', () => {
    it('calls renderer with the post-commented template and correct context', async () => {
        await handle(mockPayload, mockLog);

        expect(renderer.render).toHaveBeenCalledWith('post-commented', expect.objectContaining({
            recipientName: mockPayload.postAuthorName,
            commenterName: mockPayload.commenterName,
            commentText: mockPayload.commentText,
            postTitle: mockPayload.postTitle,
        }));
    });

    it('calls sender with the correct recipient, subject, and html', async () => {
        await handle(mockPayload, mockLog);

        expect(sender.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: mockPayload.postAuthorEmail,
            subject: expect.stringContaining(mockPayload.commenterName),
            html: '<html>post-commented</html>',
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
