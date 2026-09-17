# Notifications Service

A standalone, event-driven microservice built with Node.js. It consumes transactional events published by other services to a RabbitMQ exchange and delivers emails to end users. It runs as two independent processes: a **consumer worker** that reads from the message queue and dispatches emails, and an **HTTP management API** for querying the notification log, retrieving delivery statistics, and replaying failed notifications.

---

## Features

- **RabbitMQ consumer** — connects to a topic exchange, consumes from a durable queue, and dispatches emails based on event type; fully decoupled from any producer service
- **Five event types** — handles `user.registered`, `user.followed`, `post.liked`, `post.commented`, and `event.ticket_purchased`, each with its own handler and Handlebars email template
- **Envelope validation** — every incoming message is parsed and validated before processing; malformed or unknown messages are immediately dead-lettered without processing
- **Idempotency** — each event carries a UUID `eventId`; the consumer checks `notification_log` before processing and silently skips any duplicate delivery
- **Exponential backoff retry** — failed deliveries are re-published with an incrementing `x-retry-count` header and an increasing TTL; after `MAX_RETRIES` attempts, the message is nacked to the dead-letter queue
- **Dead letter queue** — permanently failed or invalid messages are routed to `notifications.dlq` via `app.events.dlx` for inspection and manual replay
- **QR code attachment** — ticket confirmation emails include a PNG QR code generated from the ticket code; if generation fails, the email is sent without the attachment rather than failing the entire delivery
- **HTTP management API** — internal operational surface for listing, filtering, paginating, and inspecting notification log entries; no authentication required
- **Replay endpoint** — re-queues a failed notification by `eventId` without requiring an upstream service to re-publish the original event
- **Structured logging** — Pino JSON logs at every lifecycle event; every log entry in the consumer includes `eventId` and `eventType` for end-to-end traceability

---

## Two Entry Points

This service runs as **two separate processes**. Neither imports the other's entry point. They share `src/configs/`, `src/models/`, and `src/utils/`.

| Command | What it starts | Port |
|---|---|---|
| `node src/consumer/index.js` | RabbitMQ consumer worker | — |
| `node src/index.js` | HTTP management API | `3001` |
| `docker-compose up` | Both processes + shared infrastructure | `3032` (mapped) |

The consumer is the core of this service. The HTTP API is a secondary, operational surface.

---

## API Endpoints

### Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/notifications` | List log entries — filterable by `status`, `eventType`, `startDate`, `endDate`; paginated |
| `GET` | `/api/v1/notifications/stats` | Aggregated counts by status and event type for a date range |
| `GET` | `/api/v1/notifications/:eventId` | Single log entry by `eventId` |
| `POST` | `/api/v1/notifications/replay/:eventId` | Re-queue a failed notification for reprocessing |

> **Route order matters:** `/stats` is mounted before `/:eventId` so Express does not attempt to resolve the literal string `stats` as an `eventId` path parameter.

### Infrastructure

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check — reports `db` and `amqp` connection status |

### Query Parameters — `GET /api/v1/notifications`

| Param | Type | Description |
|---|---|---|
| `status` | `pending` \| `sent` \| `failed` | Filter by delivery status |
| `eventType` | string | Filter by event type (e.g. `user.registered`) |
| `startDate` | ISO 8601 date | Lower bound on `createdAt` |
| `endDate` | ISO 8601 date | Upper bound on `createdAt` |
| `page` | integer ≥ 1 | Page number (default: `1`) |
| `pageSize` | integer ≥ 1 | Results per page (default: `10`) |

### HTTP Status Codes

| Code | When Used |
|---|---|
| `200 OK` | Successful read or replay queued |
| `400 Bad Request` | Invalid query params or non-UUID `eventId` |
| `404 Not Found` | `eventId` does not exist in the log |
| `409 Conflict` | Replay attempted on a non-`failed` notification |
| `500 Internal Server Error` | Unhandled exception |

---

## Prerequisites

- Node.js 20+ (LTS)
- PostgreSQL 15+
- RabbitMQ 3.12+ (on the `dev-infra` Docker network)
- An SMTP server (Mailtrap sandbox recommended for development)

---

## Tech Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js 20 (LTS) |
| Framework | Express.js ^5.2 |
| Message broker client | amqplib ^0.10 (low-level AMQP 0-9-1) |
| ORM | Sequelize ^6.37 + sequelize-cli |
| Database | PostgreSQL |
| Email transport | nodemailer ^6.9 |
| Email templates | handlebars ^4.7 (.hbs files, loaded at startup) |
| QR code generation | qrcode ^1.5 |
| Validation | express-validator ^7.3 (HTTP API); plain JS (consumer) |
| ID handling | uuid ^9 (idempotency checks) |
| Logging | pino ^9 |
| Environment config | dotenv ^17 |
| Testing | Jest + Supertest + @faker-js/faker |
| Dev server | nodemon |

---

## Environment Variables

Create a `.env` file at the project root. All variables are required unless a default is noted.

```env
# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# Pagination defaults
DEFAULT_PAGE=1
DEFAULT_PAGE_SIZE=10

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
POSTGRES_DATABASE=notifications_db
POSTGRES_DATABASE_TEST=notifications_db_test

# RabbitMQ
AMQP_URL=amqp://guest:password@rabbitmq-dev:5672
EXCHANGE_NAME=app.events
QUEUE_NAME=notifications.queue
DLX_NAME=app.events.dlx
DLQ_NAME=notifications.dlq
MAX_RETRIES=3           # delivery attempts before routing to DLQ
RETRY_DELAY_MS=5000     # base backoff delay in ms; multiplied by retry count

# SMTP (Mailtrap sandbox for development)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_mailtrap_user
SMTP_PASS=your_mailtrap_pass
EMAIL_FROM="Notifications" <no-reply@yourapp.com>

# App info (used in email templates)
APP_NAME=YourApp
APP_URL=https://yourapp.com
```

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your database credentials, RabbitMQ URL, and SMTP details
```

### 3. Run database migrations

```bash
npx sequelize-cli db:migrate
```

### 4. Start both processes

```bash
# Consumer worker (terminal 1)
node src/consumer/index.js

# HTTP management API (terminal 2)
node src/index.js
```

Or start everything with Docker Compose (includes RabbitMQ and PostgreSQL):

```bash
docker-compose up --build
```

The HTTP API will be available at `http://localhost:3032` (Docker) or `http://localhost:3001` (local). A `GET /health` check reports live `db` and `amqp` connection status.

---

## Running Tests

Tests run against a dedicated `POSTGRES_DATABASE_TEST` database. Jest's `globalSetup` creates it and runs all pending migrations before the suite starts; `globalTeardown` drops it when the suite finishes. RabbitMQ and Nodemailer are **not** used in tests — handlers are unit-tested with mocked `sender` and `renderer`; the HTTP API is integration-tested against a real PostgreSQL database.

```bash
# Run the full test suite
npm test

# Run a single test file
npm test -- --testPathPattern=list-notifications

# Run with verbose output
npm test -- --verbose
```

Integration tests seed `NotificationLog` rows directly via the Sequelize model in `beforeAll` blocks. No mocks are used for the database — this keeps query semantics faithful to production.

---

## Database Migrations

```bash
# Run pending migrations
npx sequelize-cli db:migrate

# Generate a new migration file
npx sequelize-cli migration:generate --name <description>

# Undo the last migration
npx sequelize-cli db:migrate:undo
```

Migrations live in `src/migrations/` and follow the pattern `<timestamp>-<description>.js`.

---

## How It Works

### RabbitMQ topology and ownership

All RabbitMQ infrastructure — exchanges, queues, and bindings — is declared by this service on every startup via `src/configs/rabbitmq.js`. Declarations use `assertExchange` and `assertQueue`, which are idempotent (safe to run on every restart; they create if not present, verify if already present).

| Component | Name | Type / Config |
|---|---|---|
| Exchange | `app.events` | Topic, durable |
| Queue | `notifications.queue` | Durable, dead-letters to `app.events.dlx` |
| Binding (users) | `app.events` → `notifications.queue` | Routing key: `user.#` |
| Binding (posts) | `app.events` → `notifications.queue` | Routing key: `post.#` |
| Binding (events) | `app.events` → `notifications.queue` | Routing key: `event.#` |
| DL Exchange | `app.events.dlx` | Fanout, durable |
| DL Queue | `notifications.dlq` | Durable |

Producer services (like the authentication service) publish to `app.events` with a routing key. RabbitMQ matches the key against the bindings and routes matching messages to `notifications.queue`. Producer services do not assert this topology — they only need to know the exchange name.

**Why a topic exchange?** The `#` wildcard matches zero or more dot-separated words. This means `user.#` matches `user.registered`, `user.followed`, and any future `user.*` event type without requiring a binding change. New event categories can be added by adding a binding, not by changing the exchange.

---

### Message processing pipeline

Every message from `notifications.queue` passes through five sequential steps in `src/consumer/event-handler.js`:

```
Incoming message
      │
      ▼
Step 1 — Parse
      JSON.parse(msg.content.toString())
      On failure: nack → DLQ
      │
      ▼
Step 2 — Validate envelope
      eventId (UUID v4), eventType (known), timestamp (ISO 8601), payload (object), recipient email (valid format)
      On failure: nack → DLQ
      │
      ▼
Step 3 — Idempotency check
      SELECT from notification_log WHERE eventId = ?
      If status='sent':    ack + skip
      If status='pending' and retryCount=0: ack + skip
      If not found:        INSERT pending log row
      │
      ▼
Step 4 — Route to handler
      handlers[eventType].handle(payload, log)
      On success: ack + update log → 'sent'
      │
      ▼
Step 5 — Retry or DLQ
      On failure: retryCount < MAX_RETRIES → re-publish with backoff
                  retryCount >= MAX_RETRIES → update log → 'failed' + nack → DLQ
```

**Manual acknowledgement** (`noAck: false`) is used throughout. A message is never automatically removed from the queue — the consumer explicitly calls `channel.ack(msg)` on success or `channel.nack(msg, false, false)` on permanent failure.

**Delivery over logging.** If the database write to `notification_log` fails after a successful email send, the error is logged but the message is still acked. Email delivery is the primary concern; an audit log failure is not a reason to re-deliver an already-sent email.

---

### Event handlers

Each of the five event types has a dedicated handler in `src/consumer/handlers/`. Every handler follows the same pattern:

1. Render the HTML email body using `renderer.render(templateName, context)`.
2. Send it via `sender.sendEmail({ to, subject, html, attachments? })`.
3. Log the delivery outcome with `eventId`, `eventType`, and the SMTP `messageId`.
4. Update `notification_log` to `status: 'sent'` with a `processedAt` timestamp.

Handlers receive a validated `payload` and the existing `log` instance. They never interact with `channel`, `msg`, or AMQP directly — that is `event-handler.js`'s responsibility. This separation makes handlers independently testable with simple mocks.

| Event Type | Handler | Template | Notable Behaviour |
|---|---|---|---|
| `user.registered` | `user-registered.js` | `welcome.hbs` | — |
| `user.followed` | `user-followed.js` | `new-follower.hbs` | — |
| `post.liked` | `post-liked.js` | `post-liked.hbs` | — |
| `post.commented` | `post-commented.js` | `post-commented.hbs` | — |
| `event.ticket_purchased` | `ticket-purchased.js` | `ticket-confirmation.hbs` | Generates a QR PNG from `ticketCode` and attaches it; degrades gracefully if QR generation fails |

---

### Email rendering with Handlebars

`src/email/renderer.js` loads all `.hbs` template files from `src/email/templates/` **once at startup** and compiles them into Handlebars template functions cached in memory. This is a deliberate fail-fast design: if any template file is missing at startup, the consumer exits immediately rather than discovering the missing template mid-delivery.

```
loadTemplates() called at startup
  → reads src/email/templates/*.hbs
  → handlebars.compile(source) for each file
  → cached in templates{} object

render(templateName, context) called per delivery
  → looks up compiled template function
  → calls template(context) → HTML string
  → throws if templateName not found (triggers handler error → retry)
```

Templates use inline styles only — email clients strip `<style>` blocks. Nodemailer's `text` option is set by stripping HTML tags from the rendered output, providing a plain-text fallback for email clients that don't render HTML.

---

### Retry pattern with exponential backoff

When a handler throws (SMTP failure, template error, network timeout), the consumer does not immediately dead-letter the message. It re-publishes the original message content to the same exchange with the same routing key, incrementing `x-retry-count` in the headers and setting a per-message TTL via the `expiration` property:

```
expiration = RETRY_DELAY_MS × (retryCount + 1)
```

With `RETRY_DELAY_MS=5000` and `MAX_RETRIES=3`, the delays before each attempt are:

| Attempt | Delay before retry |
|---|---|
| 1st retry | 5 000 ms |
| 2nd retry | 10 000 ms |
| 3rd retry | 15 000 ms |
| Max reached | nack → DLQ |

The original message is **acked** after the re-published copy is sent. The re-published copy carries `x-retry-count` in its headers, so the next delivery picks up where the count left off.

When `retryCount >= MAX_RETRIES`, the message is nacked with `requeue: false`, which routes it to `app.events.dlx` (the dead-letter exchange), then to `notifications.dlq`. From there it can be inspected and replayed via the HTTP API.

---

### Replay

The `POST /api/v1/notifications/replay/:eventId` endpoint re-queues a failed notification without requiring the original producer to re-publish. It:

1. Looks up the `notification_log` row by `eventId`.
2. Verifies the status is `failed` (409 Conflict otherwise).
3. Re-publishes the stored `payload` to `app.events` using the original `eventType` as the routing key.
4. Returns the `eventId` and `eventType` — the consumer will process the replayed message through the normal pipeline.

The replayed message uses the **original** `eventId`. The idempotency check in the consumer recognises the existing log row and updates it rather than creating a new one.

---

### Graceful shutdown

When the consumer receives `SIGTERM`:

1. `channel.cancel(consumerTag)` — stops accepting new messages from the queue.
2. Any in-flight message being processed at that moment finishes naturally.
3. `channel.close()` — closes the channel cleanly.
4. `connection.close()` — closes the AMQP TCP connection.
5. `process.exit(0)` — exits cleanly.

No message is left in an un-acked state after a clean shutdown. Docker Compose sends `SIGTERM` on `docker-compose stop` or `docker-compose down`.

---

## Notification Log — Data Model

The `notification_log` table is the single source of truth for delivery history. Every event processed by the consumer produces one row.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `eventId` | UUID | Unique — the idempotency key from the event envelope |
| `eventType` | STRING(100) | e.g. `user.registered` |
| `recipientEmail` | STRING(255) | Delivery address |
| `recipientName` | STRING(255) | Display name (nullable) |
| `status` | ENUM | `pending` → `sent` or `failed` |
| `failureReason` | TEXT | Set when `status = 'failed'` |
| `retryCount` | SMALLINT | Number of delivery attempts made |
| `processedAt` | DATE | Timestamp of successful delivery |
| `payload` | JSONB | Original event payload, stored for replay |
| `createdAt` | DATE | Row creation time |
| `updatedAt` | DATE | Last update time |

Indexes on `eventId` (unique), `status`, and `eventType` support the common query patterns in the HTTP API.

---

## Scripts Reference

| Script | Command | Description |
|---|---|---|
| Start API (production) | `npm start` | Run HTTP API with `node` |
| Start API (development) | `npm run dev` | Run HTTP API with `nodemon` (hot reload) |
| Start consumer | `node src/consumer/index.js` | Run consumer worker |
| Migrate | `npm run migrate` | Run pending Sequelize migrations |
| Test | `npm test` | Run Jest suite (creates and tears down test DB) |
| Lint | `npm run lint` | ESLint check |
| Lint (fix) | `npm run lint:fix` | ESLint auto-fix |
| Format check | `npm run format:check` | Prettier check |
| Format (fix) | `npm run format:fix` | Prettier auto-fix |

### CLI scripts

```bash
# Publish a test event to RabbitMQ (development)
node scripts/produce-event.js --event user.registered --email your@email.com

# Publish multiple events
node scripts/produce-event.js --event user.followed --count 10

# Publish a malformed event (test DLQ routing)
node scripts/produce-event.js --event user.followed --malformed

# Replay a failed event by eventId
node scripts/replay-event.js --eventId <uuid>
```
