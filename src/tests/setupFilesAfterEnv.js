const sequelize = require('../configs/sequelize');

afterAll(async () => {
    await sequelize.close();
});
