jest.mock('qrcode');
jest.mock('../../../email/sender');
jest.mock('../../../email/renderer');
jest.mock('../../../repositories/notification-repository');

const qrcode = require('qrcode');
const sender = require('../../../email/sender');
const renderer = require('../../../email/renderer');
const notificationRepository = require('../../../repositories/notification-repository');
const { handle } = require('../../../consumer/handlers/ticket-purchased');

const mockPayload = {
    userEmail: 'dave@example.com',
    userName: 'Dave',
    eventName: 'Jazz Night',
    eventDate: '2026-10-15T20:00:00.000Z',
    eventVenue: 'The Blue Note',
    ticketId: 'ticket-uuid-1',
    ticketCode: 'TKT-001',
};

const mockLog = {
    id: 'log-id-5',
    eventId: 'event-id-5',
    eventType: 'event.ticket_purchased',
};

const fakeQrBuffer = Buffer.from('fake-qr-data');

beforeEach(() => {
    jest.clearAllMocks();
    qrcode.toBuffer.mockResolvedValue(fakeQrBuffer);
    renderer.render.mockReturnValue('<html>ticket-confirmation</html>');
    sender.sendEmail.mockResolvedValue({ messageId: 'msg-005' });
    notificationRepository.updateLog.mockResolvedValue();
});

describe('ticket-purchased handler', () => {
    it('calls renderer with the ticket-confirmation template and correct context', async () => {
        await handle(mockPayload, mockLog);

        expect(renderer.render).toHaveBeenCalledWith('ticket-confirmation', expect.objectContaining({
            recipientName: mockPayload.userName,
            eventName: mockPayload.eventName,
            ticketCode: mockPayload.ticketCode,
            eventVenue: mockPayload.eventVenue,
        }));
    });

    it('calls sender with the correct recipient, subject, html, and QR attachment', async () => {
        await handle(mockPayload, mockLog);

        expect(sender.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: mockPayload.userEmail,
            subject: expect.stringContaining(mockPayload.eventName),
            html: '<html>ticket-confirmation</html>',
            attachments: expect.arrayContaining([
                expect.objectContaining({ cid: 'ticket-qr', content: fakeQrBuffer }),
            ]),
        }));
    });

    it('sends email without attachment when QR generation fails', async () => {
        qrcode.toBuffer.mockRejectedValue(new Error('QR generation error'));

        await handle(mockPayload, mockLog);

        expect(sender.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            attachments: [],
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
