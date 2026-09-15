const { Router } = require('express');
const controller = require('../controllers/notifications-controller');
const {
    listNotificationsMiddlewares,
    getStatsMiddlewares,
} = require('../middlewares/notifications-middlewares');

const router = Router();

router.get('/', listNotificationsMiddlewares, controller.list);
router.get('/stats', getStatsMiddlewares, controller.getStats);
router.get('/:eventId', controller.getOne);
router.post('/replay/:eventId', controller.replay);

module.exports = router;