const cors = require('cors');
require('./configs/sequelize');
const express = require('express');
const dotenv = require('dotenv');
const { exceptionHandler } = require('./utils/exceptions/exception-handler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
    res.send('The Notifications Service is running.')
});

// Protected routes


// Exception handler
app.use(exceptionHandler);

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
