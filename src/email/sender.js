const nodemailer = require('nodemailer');
const config = require('../configs/config');

const transport = nodemailer.createTransport({
    host: config.app.SMTP_HOST,
    port: config.app.SMTP_PORT,
    auth: {
        user: config.app.SMTP_USER,
        pass: config.app.SMTP_PASS,
    },
});

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
    const info = await transport.sendMail({
        from: config.app.EMAIL_FROM,
        to,
        subject,
        html,
        text: html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
        attachments,
    });
    return info;
};

module.exports = { sendEmail };
