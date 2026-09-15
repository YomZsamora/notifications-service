afterAll(async () => {
    const sequelize = require('../configs/sequelize');
    await sequelize.close();
    jest.resetModules();
});
