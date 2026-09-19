# AGENTS.md — notifications-service

This file provides guidance for AI coding agents working on the Notifications Service — a standalone,
event-driven microservice that consumes RabbitMQ events and delivers transactional emails. Conventions
shared with the expense-tracker ecosystem are retained here; differences are called out explicitly.

---

## Tech Stack

| Concern | Choice |
| --- | --- |
| **Runtime** | Node.js ≥ 20 LTS |
| **HTTP framework** | Express.js (management API only) |
| **Message broker client** | `amqplib` (low-level AMQP 0-9-1 — no wrapper library) |
| **Validation** | `express-validator` (HTTP API query params); plain JS checks (consumer messages) |
| **Database / ORM** | PostgreSQL via `sequelize` + `sequelize-cli` (migrations) |
| **Email transport** | `nodemailer` (Mailtrap SMTP for dev) |
| **Email templates** | `handlebars` (.hbs files, loaded from disk at startup) |
| **QR code generation** | `qrcode` (ticket confirmation attachment) |
| **Logging** | `pino` (structured JSON — replaces Winston) |
| **Environment config** | `dotenv` |
| **IDs** | `uuid` |
| **Testing** | Jest + Supertest + `@faker-js/faker` |
| **Process manager** | `nodemon` (dev), `node` (prod) |

> **No auth.** This is an internal service — no JWT, no `isUserAuthenticated`, no `bcryptjs`.
> **No Redis.** `ioredis` is in the boilerplate `package.json` but is not used by this service — remove it.

---

## Repository Layout

```
src/
  index.js                            # Express app entry point — registers routes, middleware, starts server
  app/
    controllers/                      # Route controller functions (*-controller.js)
    middlewares/                      # Feature-level middleware arrays (*-middlewares.js)
    routes/                           # Express Router definitions (*-routes.js)
  configs/
    config.js                         # Environment-aware app config (reads from process.env)
    sequelize.js                      # Sequelize instance
    rabbitmq.js                       # amqplib connection + channel; asserts topology on startup
  consumer/
    index.js                          # Connects to AMQP, binds queue, starts consuming
    eventHandler.js                   # Parses + validates message; routes by eventType
    handlers/
      userRegistered.js
      userFollowed.js
      postLiked.js
      postCommented.js
      ticketPurchased.js
  email/
    sender.js                         # Nodemailer transport + sendEmail() function
    renderer.js                       # Handlebars compile + render(templateName, context)
    templates/
      welcome.hbs
      new-follower.hbs
      post-liked.hbs
      post-commented.hbs
      ticket-confirmation.hbs
  models/
    notification-log.js               # sequelize.define(...)
  migrations/                         # Sequelize-CLI migrations
  repositories/                       # Data-access functions (*-repository.js)
  tests/
    setup.js                          # globalSetup — creates test DB, runs migrations
    teardown.js                       # globalTeardown — drops test DB
    setupFilesAfterEnv.js             # afterAll — closes sequelize connection
    unit/
      handlers/                       # One test file per handler (mocked sender)
    integration/
      api/                            # Supertest tests for HTTP endpoints
  utils/
    exceptions/
      custom-exceptions.js            # Custom error classes
      exception-handler.js            # Global Express error handler + handleBadRequests helper
    serializers/
      notification-serializer.js
    validators/
      notification-validators.js      # express-validator chains for HTTP API query params
    responses.js                      # ApiResponse class
scripts/
  produce-event.js                    # CLI: publishes a test event to RabbitMQ
  replay-event.js                     # CLI: re-publishes a failed eventId from the log
```

---

## Entry Points

This service has **two distinct entry points**, each a separate long-running process:

| Command | What it starts |
| --- | --- |
| `node src/consumer/index.js` | RabbitMQ consumer worker — connects to AMQP, starts consuming |
| `node src/index.js` | HTTP management API — Express on `PORT` (default 3001) |
| `docker-compose up` | Both processes + RabbitMQ + PostgreSQL |

The consumer and the HTTP API are **separate services** in Docker Compose. Neither imports the other's
entry point. They share `src/configs/`, `src/models/`, and `src/utils/`.

---

## Architecture Rules

1. **Consumer is the core** — the HTTP API is a secondary, operational surface. The consumer is where
   the primary business logic lives.
2. **Thin event handlers** — each handler in `consumer/handlers/` does exactly: build email context,
   call `renderer.render()`, call `sender.sendEmail()`, update the `NotificationLog`. No AMQP logic
   inside handlers.
3. **`eventHandler.js` owns routing** — it parses the message body, runs schema validation, checks
   idempotency, creates the pending log row, then delegates to the correct handler by `eventType`.
   Handlers receive the validated `payload` and the `log` instance — they never touch `channel` or
   `msg` directly.
4. **Handlers are injected, not hard-imported** — `sender` and `renderer` are passed into handlers
   (or imported at the top of the handler file); `amqplib` and `nodemailer` are **never** required
   inside handler files. This keeps them independently testable.
5. **Repositories own data access** — no handler, controller, or service queries Sequelize models
   directly. All DB reads/writes go through `src/repositories/notification-repository.js`, called via
   namespace: `const notificationRepository = require('...')`.
6. **`rabbitmq.js` owns topology** — `assertExchange`, `assertQueue`, `bindQueue` are called once in
   `src/config/rabbitmq.js` on every connection. They are idempotent and safe to re-run on restart.
7. **Global error handler** — `exceptionHandler` from `src/utils/exceptions/exception-handler.js` is
   registered as the last middleware in `src/index.js`. HTTP controllers call `next(error)` and never
   send error responses directly.
8. **No secrets in code** — all config values come from `process.env` via `src/configs/config.js`.
   Never read `process.env` directly in consumer, handler, or controller files.
9. **Delivery > logging** — if writing to `notification_log` fails, log the error but do not nack the
   message. Email delivery takes priority over the audit log.

---

## RabbitMQ Topology

All topology is declared in `src/config/rabbitmq.js` using `assertExchange` / `assertQueue` /
`bindQueue`. Every declaration is idempotent — safe to run on every startup.

| Component | Name | Type / Config |
| --- | --- | --- |
| Exchange | `app.events` | Topic, durable |
| Queue | `notifications.queue` | Durable, `x-dead-letter-exchange: app.events.dlx` |
| Binding | `app.events` → `notifications.queue` | Routing keys: `user.#` and `post.#` |
| DL Exchange | `app.events.dlx` | Direct, durable |
| DL Queue | `notifications.dlq` | Durable |

```js
// src/configs/rabbitmq.js — topology assertion pattern
await channel.assertExchange('app.events', 'topic', { durable: true });
await channel.assertExchange('app.events.dlx', 'direct', { durable: true });
await channel.assertQueue('notifications.queue', {
    durable: true,
    arguments: { 'x-dead-letter-exchange': 'app.events.dlx' },
});
await channel.assertQueue('notifications.dlq', { durable: true });
await channel.bindQueue('notifications.queue', 'app.events', 'user.#');
await channel.bindQueue('notifications.queue', 'app.events', 'post.#');
```

### Routing Keys

| Routing Key | Email Triggered |
| --- | --- |
| `user.registered` | Welcome email |
| `user.followed` | New follower notification |
| `post.liked` | Post liked notification |
| `post.commented` | Post commented notification |
| `event.ticket_purchased` | Ticket confirmation with QR attachment |

---

## Message Acknowledgement

The consumer uses **manual acknowledgements** (`noAck: false`). Never auto-ack.

| Outcome | Action | Result |
| --- | --- | --- |
| Email sent successfully | `channel.ack(msg)` | Message removed from queue |
| Transient failure (SMTP timeout, soft bounce) | Re-publish with incremented `x-retry-count` + backoff TTL; `channel.ack(msg)` original | Retried with exponential delay |
| Permanent failure (max retries exhausted, hard bounce) | `channel.nack(msg, false, false)` | Routed to DLQ via DLX |
| Invalid / malformed message | `channel.nack(msg, false, false)` | Immediately dead-lettered |

### Retry Pattern

```js
const MAX_RETRIES = config.MAX_RETRIES; // read from env via config/env.js
const RETRY_DELAY_MS = config.RETRY_DELAY_MS;

const retryCount = msg.properties.headers['x-retry-count'] || 0;

if (retryCount >= MAX_RETRIES) {
    await notificationRepository.updateLog(log.id, { status: 'failed', failureReason: err.message });
    channel.nack(msg, false, false); // → DLQ
} else {
    channel.publish(
        'app.events',
        msg.fields.routingKey,
        msg.content,
        {
            ...msg.properties,
            headers: { 'x-retry-count': retryCount + 1 },
            expiration: String(RETRY_DELAY_MS * (retryCount + 1)), // exponential backoff
        }
    );
    channel.ack(msg); // ack original; re-published copy carries the retry count
}
```

---

## Validation

### Consumer — Plain JS Schema Checks

`express-validator` is HTTP middleware and cannot be used inside the RabbitMQ consumer. Consumer
message validation is done with plain JavaScript checks in `src/consumer/eventHandler.js`. If
validation fails, immediately `nack(false, false)` to DLQ — do not process further.

Every event envelope must have:

| Field | Rule |
| --- | --- |
| `eventId` | Required. Valid UUID v4. Used as idempotency key. |
| `eventType` | Required. One of the 5 known event types. |
| `timestamp` | Required. Valid ISO 8601 datetime string. |
| `payload` | Required object. Shape validated per `eventType`. |
| `payload.*.email` | Any email field: valid email format. |

### HTTP API — express-validator

Query param validation for the HTTP management API lives in
`src/utils/validators/notification-validators.js`, following the same patterns as expense-tracker.

```js
const { query } = require('express-validator');

const statusQueryValidator = query('status')
    .optional()
    .isIn(['pending', 'sent', 'failed']).withMessage('Status must be pending, sent, or failed.');

const eventTypeQueryValidator = query('eventType')
    .optional()
    .isIn(['user.registered', 'user.followed', 'post.liked', 'post.commented', 'event.ticket_purchased'])
    .withMessage('Invalid event type.');

const pageQueryValidator = query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer.');
```

The `handleBadRequests(errorMessage)` helper from `exception-handler.js` is placed in middleware
arrays after `express-validator` chains, exactly as in expense-tracker.

---

## Idempotency Pattern

Before any processing, check whether `eventId` already exists in `notification_log`. If it does, ack
and skip — do not send a duplicate email.

```js
// In eventHandler.js, before doing anything else:
const existing = await notificationRepository.findLogByEventId(eventId);
if (existing) {
    logger.warn({ eventId }, 'Duplicate event received — skipping');
    channel.ack(msg);
    return;
}

// Create pending record first, then attempt delivery
const log = await notificationRepository.createLog({ eventId, eventType, recipientEmail, status: 'pending' });
// On success: notificationRepository.updateLog(log.id, { status: 'sent', processedAt: new Date() })
// On failure: notificationRepository.updateLog(log.id, { status: 'failed', failureReason: err.message })
```

---

## Sequelize Model

`src/models/notification-log.js` uses `sequelize.define(...)` directly — **not** the factory pattern.

```js
const { DataTypes } = require('sequelize');
const sequelize = require('../configs/sequelize');

const NotificationLog = sequelize.define('NotificationLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    eventId: { type: DataTypes.UUID, allowNull: false, unique: true },
    eventType: { type: DataTypes.STRING(100), allowNull: false },
    recipientEmail: { type: DataTypes.STRING(255), allowNull: false },
    recipientName: { type: DataTypes.STRING(255), allowNull: true },
    status: {
        type: DataTypes.ENUM('pending', 'sent', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
    },
    failureReason: { type: DataTypes.TEXT, allowNull: true },
    retryCount: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
    processedAt: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: 'notification_log',
    indexes: [
        { name: 'idx_notification_log_eventId', fields: ['eventId'], unique: true },
        { name: 'idx_notification_log_status', fields: ['status'] },
        { name: 'idx_notification_log_eventType', fields: ['eventType'] },
    ],
});

module.exports = { NotificationLog };
```

### Model Field Format

Use the **compact inline format**: each field on one line, all properties on that same line, with
colons aligned for readability. This is the enforced convention — do not expand simple fields into
multi-line blocks.

```js
// correct — compact inline
id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
code:         { type: DataTypes.STRING(20), allowNull: false, unique: true },
expiresAt:    { type: DataTypes.DATE, allowNull: true },
```

```js
// wrong — unnecessarily expanded
id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
},
```

Use the expanded multi-line format **only** when a field definition is genuinely complex — for
example, a deeply nested `validate` block or a long composite `references` object — where the
inline version would exceed a readable line length. This is a judgment call enforced at code
review; there is no automated lint rule for it.

> There is only one model. No `associations.js` is needed.

---

## Data Access — Repository

`src/repositories/notification-repository.js` is the only place that imports and queries
`NotificationLog`. Called via namespace — never destructured.

```js
const notificationRepository = require('../../repositories/notification-repository');

await notificationRepository.findLogByEventId(eventId);
await notificationRepository.createLog({ eventId, eventType, recipientEmail, status: 'pending' });
await notificationRepository.updateLog(id, { status: 'sent', processedAt: new Date() });
```

---

## Email Templates

Templates live in `src/email/templates/` as `.hbs` files. They are **loaded from disk at startup and
cached in memory** by `src/email/renderer.js`. If a template file is missing at startup, the consumer
must fail fast and not start.

| Event Type | Template File | Subject Line |
| --- | --- | --- |
| `user.registered` | `welcome.hbs` | `Welcome to {{appName}}, {{name}}!` |
| `user.followed` | `new-follower.hbs` | `{{followerName}} started following you` |
| `post.liked` | `post-liked.hbs` | `{{likerName}} liked your post` |
| `post.commented` | `post-commented.hbs` | `{{commenterName}} commented on your post` |
| `event.ticket_purchased` | `ticket-confirmation.hbs` | `Your ticket for {{eventName}} — {{ticketCode}}` |

### Template Rules

- **Responsive HTML with inline styles only** — email clients strip `<style>` blocks.
- **Plain-text fallback** — always pass a `text` option to Nodemailer (can be auto-stripped HTML).
- **Standard footer** — every template includes app name, "You received this because..." and an
  unsubscribe placeholder link.
- **QR attachment** — `ticketPurchased.js` generates a QR PNG from `ticketCode` using the `qrcode`
  package and passes it as a Nodemailer attachment. If QR generation fails, send the email without the
  attachment and log a warning — do not fail the entire delivery.

### Renderer Pattern

```js
// src/email/renderer.js
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const templates = {};

const loadTemplates = () => {
    const templateDir = path.join(__dirname, 'templates');
    const files = fs.readdirSync(templateDir).filter(f => f.endsWith('.hbs'));
    for (const file of files) {
        const name = path.basename(file, '.hbs');
        templates[name] = handlebars.compile(fs.readFileSync(path.join(templateDir, file), 'utf8'));
    }
};

const render = (templateName, context) => {
    if (!templates[templateName]) throw new Error(`Template not found: ${templateName}`);
    return templates[templateName](context);
};

module.exports = { loadTemplates, render };
```

---

## HTTP Management API

The HTTP API in `src/app.js` is an internal operational surface — no authentication required.

### Response Envelope

All HTTP responses use the same `ApiResponse` shape from `src/utils/responses.js`:

```json
{ "status": "success", "message": "...", "data": { ... } }
```

### Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | App status, RabbitMQ and DB connection state |
| `GET` | `/api/v1/notifications` | List log entries — filterable by `status`, `eventType`, `startDate`, `endDate`; paginated |
| `GET` | `/api/v1/notifications/stats` | Aggregated counts by status and event type for a date range |
| `GET` | `/api/v1/notifications/:eventId` | Single log entry by `eventId` |
| `POST` | `/api/v1/notifications/replay/:eventId` | Re-process a failed notification |

> **Route ordering matters:** mount `/api/v1/notifications/stats` **before** `/api/v1/notifications/:eventId`
> so Express does not try to resolve `stats` as an `eventId` param.

### HTTP Status Codes

| Code | When Used |
| --- | --- |
| `200 OK` | Successful read |
| `400 Bad Request` | Invalid query params |
| `404 Not Found` | `eventId` does not exist in the log |
| `409 Conflict` | Replay attempted on a non-failed notification |
| `500 Internal Server Error` | Unhandled exception |

---

## API Response Serializers

`src/utils/serializers/notification-serializer.js` transforms `NotificationLog` instances into
API-safe objects.

```js
const serializeNotification = (log) => ({
    id: log.id,
    eventId: log.eventId,
    eventType: log.eventType,
    recipientEmail: log.recipientEmail,
    recipientName: log.recipientName,
    status: log.status,
    failureReason: log.failureReason,
    retryCount: log.retryCount,
    processedAt: log.processedAt,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
});

const serializeNotificationList = (logs) => logs.map(serializeNotification);

module.exports = { serializeNotification, serializeNotificationList };
```

**Controllers only** — serializers are called exclusively from controllers, via namespace import.

---

## Logging (Pino)

Use `pino` for all logging. Every log entry is a JSON object. Never use `console.log` in production
paths.

```js
const config = require('../configs/config');
const logger = require('pino')({ level: config.app.LOG_LEVEL || 'info' });

// Successful delivery
logger.info({ eventId, eventType, recipient: recipientEmail }, 'Email delivered');

// Retry
logger.warn({ eventId, retryCount, error: err.message }, 'Email delivery failed — retrying');

// Duplicate skipped
logger.warn({ eventId }, 'Duplicate event received — skipping');

// Max retries exceeded
logger.error({ eventId, retryCount }, 'Max retries exceeded — routing to DLQ');
```

Every consumer log entry must include `eventId` and `eventType`. Every delivery outcome log must
include `status`.

---

## Custom Exceptions

`src/utils/exceptions/custom-exceptions.js` — same pattern as expense-tracker. Only the subset
relevant to the HTTP management API is needed here.

| Class | Status | When to throw |
| --- | --- | --- |
| `BadRequest` | 400 | Invalid query params |
| `NotFound` | 404 | `eventId` not in notification log |
| `Conflict` | 409 | Replay on a non-failed notification |

**Rule:** whenever a new exception class is added, a matching `instanceof` block must be added to
`exceptionHandler` in `src/utils/exceptions/exception-handler.js`.

---

## Graceful Shutdown

The consumer entry point (`src/consumer/index.js`) must handle `SIGTERM` and the HTTP entry point
(`src/index.js`) must close the Express server cleanly:

1. Stop accepting new messages (`channel.cancel(consumerTag)`).
2. Wait for any in-flight message to finish processing.
3. Close the channel cleanly (`channel.close()`).
4. Close the AMQP connection (`connection.close()`).
5. Exit with code `0`.

No message should be left in an un-acked state after a clean shutdown.

---

## RabbitMQ Reconnect

On connection drop, reconnect with exponential backoff: 1s, 2s, 4s, 8s, 16s. After 5 failed
attempts, log a fatal-level Pino entry and call `process.exit(1)`. Docker Compose `depends_on` with
`healthcheck` handles initial ordering.

---

## Testing Guidelines

### Test Types

| Type | Tool | What it tests |
| --- | --- | --- |
| **Unit** | Jest | Individual handler logic — `sender` and `renderer` are mocked |
| **Integration** | Supertest + Jest | Full HTTP request → controller → DB → serialized response |

The consumer worker is **not** tested end-to-end against a real RabbitMQ in the test suite. Handlers
are unit-tested with mocked dependencies. The HTTP API is integration-tested against a real PostgreSQL
test DB.

### Directory Structure

```
src/tests/
  setup.js                               # globalSetup — creates test DB, runs migrations
  teardown.js                            # globalTeardown — drops test DB
  setupFilesAfterEnv.js                  # afterAll — closes sequelize connection
  unit/
    handlers/
      userRegistered.test.js
      userFollowed.test.js
      postLiked.test.js
      postCommented.test.js
      ticketPurchased.test.js
  integration/
    api/
      list-notifications.test.js
      get-notification.test.js
      stats-notifications.test.js
      replay-notification.test.js
      health.test.js
```

### Unit Test Pattern (Handler)

```js
// tests/unit/handlers/userRegistered.test.js
describe('userRegistered handler', () => {
    let mockSender, mockRenderer, mockLog;

    beforeEach(() => {
        mockRenderer = { render: jest.fn().mockReturnValue('<html>...</html>') };
        mockSender = { sendEmail: jest.fn().mockResolvedValue({ messageId: 'abc' }) };
        mockLog = { id: 'log-uuid' };
    });

    it('should call renderer with correct template and context', async () => { ... });
    it('should call sender with correct to, subject, and html', async () => { ... });
    it('should propagate errors thrown by sender', async () => { ... });
});
```

### Integration Test Pattern (HTTP API)

```js
// tests/integration/api/list-notifications.test.js
describe('GET /api/v1/notifications', () => {

    beforeAll(async () => {
        // Seed NotificationLog rows directly using the model (test setup only)
    });

    afterAll(async () => {
        await NotificationLog.destroy({ where: { eventType: 'user.registered' }, force: true });
    });

    it('should return 200 with paginated notification list', async () => { ... });
    it('should filter by status=failed', async () => { ... });
    it('should filter by eventType', async () => { ... });
    it('should call next() with an error if any exception is thrown', async () => { ... });
});
```

### `setup.js`

Creates `POSTGRES_DATABASE_TEST` if it does not exist, then runs pending migrations:

```js
await execPromise('NODE_ENV=test npx sequelize-cli db:migrate');
```

`NODE_ENV=test` is mandatory — without it, the CLI migrates the wrong database.

### `setupFilesAfterEnv.js`

Closes the Sequelize connection after each test file. No RabbitMQ or Nodemailer connections to close
in tests (both are mocked in unit tests; neither is used in integration tests).

### Test Data

Seed `NotificationLog` rows directly in `beforeAll` using the model (only in test files):

```js
const { faker } = require('@faker-js/faker');
const { NotificationLog } = require('../../../models/notification-log');

log = await NotificationLog.create({
    eventId: faker.string.uuid(),
    eventType: 'user.registered',
    recipientEmail: faker.internet.email(),
    status: 'sent',
    processedAt: new Date(),
});
```

### Coverage Expectations

**Unit tests (per handler):**
- Correct template name and context passed to `renderer.render`
- Correct `to`, `subject`, and `html` passed to `sender.sendEmail`
- Errors from `sender` are propagated (not swallowed)

**Integration tests (per endpoint):**
- Success: correct shape and data returned
- Invalid query params: 400
- Not found: 404 (where applicable)
- Error propagation: direct controller call with empty `req`

---

## Scripts (CLI)

| Script | Path | Purpose |
| --- | --- | --- |
| `produce-event.js` | `scripts/produce-event.js` | Publishes a test event to RabbitMQ |
| `replay-event.js` | `scripts/replay-event.js` | Re-publishes a failed eventId from notification_log |

```bash
node scripts/produce-event.js --event user.registered
node scripts/produce-event.js --event event.ticket_purchased --email your@email.com
node scripts/produce-event.js --event user.followed --count 10
node scripts/produce-event.js --event user.followed --malformed   # test DLQ routing

node scripts/replay-event.js --eventId <uuid>
```

The producer script connects to `AMQP_URL`, generates a fresh UUID v4 as `eventId`, fills `payload`
with `faker` data, publishes to `app.events` with the correct routing key, logs the `eventId`, then
disconnects cleanly.

---

## Environment Variables

All env vars are validated and exported by `src/config/env.js`. No other file reads `process.env`
directly.

| Variable | Description | Example |
| --- | --- | --- |
| `NODE_ENV` | Environment | `development` |
| `PORT` | HTTP API port | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/notifications_db` |
| `AMQP_URL` | RabbitMQ connection string | `amqp://guest:guest@localhost:5672` |
| `EXCHANGE_NAME` | Topic exchange name | `app.events` |
| `QUEUE_NAME` | Consumer queue | `notifications.queue` |
| `DLX_NAME` | Dead letter exchange name | `app.events.dlx` |
| `DLQ_NAME` | Dead letter queue name | `notifications.dlq` |
| `MAX_RETRIES` | Max delivery attempts before DLQ | `3` |
| `RETRY_DELAY_MS` | Base backoff delay in ms | `5000` |
| `SMTP_HOST` | SMTP server host | `smtp.mailtrap.io` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `your-mailtrap-user` |
| `SMTP_PASS` | SMTP password | `your-mailtrap-pass` |
| `EMAIL_FROM` | From address | `"Notifications" <no-reply@yourapp.com>` |
| `APP_NAME` | App name used in templates | `YourApp` |
| `APP_URL` | Base URL for template links | `https://yourapp.com` |

---

## Useful Commands

```bash
# Start the consumer worker
node src/consumer/index.js

# Start the HTTP management API
node src/index.js

# Start everything via Docker
docker-compose up --build

# Run pending migrations
npx sequelize-cli db:migrate

# Create a new migration
npx sequelize-cli migration:generate --name <description>

# Run all tests
npm test

# Publish a test event (development)
node scripts/produce-event.js --event user.registered --email your@email.com
```

---

## Pull Requests & Commits

- Follow **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Keep commits small and focused — one concern per commit.
- Run `npm test` locally before opening a PR.
- PR descriptions must include: what changed, why, and any new env vars or migrations required.
- Never force-push to `main`.

---

## Things Agents Must NOT Do

- Add AMQP logic (`channel.ack`, `channel.nack`, `channel.publish`) inside handler files — those
  belong in `consumer/eventHandler.js` or `consumer/index.js`.
- Call `nodemailer` or `amqplib` directly inside handler files — inject `sender` and `renderer`.
- Read `process.env` directly in handlers, controllers, or repositories — use `src/configs/config.js`.
- Import or query a Sequelize model from anywhere other than a `src/repositories/` file.
- Destructure functions from a repository import — always call through the namespace object.
- Define a Sequelize model using the factory pattern — use `sequelize.define(...)` directly.
- Call a serializer from anywhere other than a controller.
- Swallow errors silently in handlers — always update the log and nack/ack appropriately.
- Use `console.log` in production code paths — use Pino.
- Add auth middleware to the HTTP API — this is an internal service, no auth is required.
- Immediately requeue a message without incrementing `x-retry-count` — this creates a tight loop.
- Skip the idempotency check — always check `notification_log` for `eventId` before processing.
- Start the consumer if any template fails to load at startup — fail fast.
