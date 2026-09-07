# Early Learning Services LMS

Production LMS built with React, Express, Node.js, and MySQL.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MySQL
- Database driver: mysql2

## Local development

### Server
```bash
cd server
npm install
npm run dev
```

### Client
```bash
cd client
npm install
npm run dev
```

Create `server/.env` from `server/.env.example` before starting the API.

## Production configuration

### Client
Set the Vite environment variable to the deployed API base URL, including `/api`:

```env
VITE_API_URL=https://your-api-domain.example/api
```

Build with:

```bash
cd client
npm install
npm run build
```

Deploy the contents of `client/dist` as a static site. The host must serve `index.html` as a fallback for application routes such as `/admin`.

### Server
Set these environment variables on the hosting platform:

```env
NODE_ENV=production
PORT=5001
DB_HOST=your-mysql-host
DB_PORT=3306
DB_NAME=eles_lms
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
CLIENT_URL=https://your-frontend-domain.example
JWT_SECRET=generate-a-random-secret-at-least-32-characters-long
COOKIE_SAMESITE=none
COOKIE_SECURE=true
```

If the frontend and API are served from the same site, `COOKIE_SAMESITE=lax` can be used. When they are on different sites, use `COOKIE_SAMESITE=none` and HTTPS with `COOKIE_SECURE=true`.

Run the API with:

```bash
cd server
npm install
npm start
```

## Database

Run `server/db/schema.sql` against the production MySQL database before starting the application. Do not commit production credentials or `.env` files.

## Pre-launch checks

- Confirm `/api/health` reports the database as connected.
- Confirm student registration and login.
- Confirm instructor registration and login.
- Confirm instructor course/unit/assessment management.
- Confirm student enrollment, unit progress, assessment submission and results.
- Confirm announcements and forum access.
- Confirm admin login, user controls, course publishing and reports.
- Test the deployed frontend against the deployed API over HTTPS.
