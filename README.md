# OIDC Auth Server

A custom OpenID Connect (OIDC) compliant authentication server built from scratch. Issues RS256 signed JWTs and supports the full Authorization Code Flow. Can be used as a reusable auth server for multiple applications.

---

## Project Overview

This is a standalone auth server that follows the OIDC protocol on top of OAuth 2.0. Any application can register as a client, redirect users here to login, and receive a JWT access token in return.

Built with Node.js, Express, Drizzle ORM, PostgreSQL, and RS256 JWT signing via `node-jose` and `jsonwebtoken`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express |
| Database | PostgreSQL (Docker) |
| ORM | Drizzle ORM |
| JWT Signing | jsonwebtoken (RS256) |
| JWKS | node-jose |
| Crypto | Node.js built-in `crypto` |

---

## Features

- Full OIDC Authorization Code Flow
- RS256 JWT signing with RSA key pair
- JWKS endpoint for public key exposure
- OpenID Connect discovery endpoint
- Client application registration (get `client_id` + `client_secret`)
- User registration and login
- Authorization code generation and exchange
- Userinfo endpoint
- Auth code expiry (60 seconds)
- Single-use auth codes (deleted after exchange)

---

## How to Run Locally

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd oidc-auth-server
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Generate RSA key pair

**Linux / Mac:**
```bash
bash key-gen.sh
```

**Windows:**
Use Git Bash (recommended) and run the same command:
```bash
bash key-gen.sh
```
Or use WSL (Windows Subsystem for Linux):
```bash
bash key-gen.sh
```

This generates `private.pem` and `public.pem` inside the `cert/` folder.

### 4. Start PostgreSQL with Docker

```bash
docker-compose up -d
```
### 5. Run database generations

```bash
pnpm db:generate
```

### 6. Run database migrations

```bash
pnpm db:migrate
```

### 7. Set up environment variables

```bash
cp .env.example .env
```

### 8. Start the server

```bash
pnpm dev
```

Server runs at `http://localhost:8000`

---

## Environment Variables

```env
PORT=8000
DATABASE_URL=postgresql://oidc:oidc@localhost:5432/oidc_auth
```

---

## Registering a Client Application

Before any app can use this auth server, it must register to get a `client_id` and `client_secret`.

Visit the admin registration page:
```
http://localhost:8000/o/admin/applications/register
```

Or call the API directly:

```bash
POST /o/admin/applications/register
Content-Type: application/json

{
  "applicationName": "My App",
  "redirectUri": "http://localhost:3000/callback"
}
```

Response:
```json
{
  "message": "Application registered",
  "data": {
    "clientId": "abc123...",
    "clientSecret": "xyz789...",
    "redirectUri": "http://localhost:3000/callback"
  }
}
```

Save both `clientId` and `clientSecret` — the secret is only shown once.

---

## OIDC Auth Flow

```
1. Client app redirects user to:
   GET /o/authenticate?client_id=xxx&redirect_uri=xxx

2. User sees login page, enters email and password

3. Auth server validates credentials

4. Auth server generates a short-lived authorization code (60 seconds)

5. User's browser is redirected to:
   <redirect_uri>?code=xxx

6. Client app exchanges code for token:
   POST /o/authenticate/tokeninfo
   { code, client_id, client_secret, redirect_uri }

7. Auth server returns JWT access token:
   { access_token, token_type, expires_in }

8. Client app verifies token using JWKS endpoint:
   GET /.well-known/jwks.json
```

---

## API Endpoints

### OIDC Discovery
```
GET /.well-known/openid-configuration
```
Returns issuer, authorization endpoint, token endpoint, userinfo endpoint, and JWKS URI.

---

### JWKS (Public Keys)
```
GET /.well-known/jwks.json
```
Returns the RSA public key in JWK format. Client apps use this to verify JWT signatures.

---

### Login Page
```
GET /o/authenticate?client_id=xxx&redirect_uri=xxx
```
Serves the login HTML page. Validates `client_id` before rendering.

---

### Register User
```
POST /o/authenticate/register
Content-Type: application/json

{
  "firstName": "Khalid",
  "lastName": "Hossain",
  "email": "user@example.com",
  "password": "password123"
}
```

---

### Login
```
POST /o/authenticate/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "client_id": "xxx",
  "redirect_uri": "http://localhost:3000/callback",
  "state": "optional_state"
}
```

Returns `{ redirect: "http://localhost:3000/callback?code=xxx" }`

---

### Exchange Code for Token
```
POST /o/authenticate/tokeninfo
Content-Type: application/json

{
  "code": "xxx",
  "client_id": "xxx",
  "client_secret": "xxx",
  "redirect_uri": "http://localhost:3000/callback"
}
```

Returns:
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

### Get User Info
```
GET /o/userinfo
Authorization: Bearer <access_token>
```

Returns user profile from the JWT claims.

---

### Get Client Info
```
GET /o/authenticate/client-info?client_id=xxx
```

Returns application name and redirect URI for the given client.

---

### Register Client Application (Admin)
```
GET  /o/admin/applications/register  → serves registration form
POST /o/admin/applications/register  → creates client, returns client_id + client_secret
```

---

## JWT Claims

Tokens issued by this server include the following OIDC standard claims:

| Claim | Description |
|---|---|
| `iss` | Issuer (auth server URL) |
| `sub` | User ID |
| `email` | User email |
| `email_verified` | Email verification status |
| `given_name` | First name |
| `family_name` | Last name |
| `name` | Full name |
| `picture` | Profile image URL |
| `exp` | Expiry (1 hour) |
| `iat` | Issued at |

---

## Database Schema

### users
| Column | Type |
|---|---|
| id | UUID (PK) |
| first_name | VARCHAR |
| last_name | VARCHAR |
| email | VARCHAR (unique) |
| password | VARCHAR (SHA-256 hashed) |
| email_verified | BOOLEAN |
| profile_image_url | TEXT |
| created_at | TIMESTAMP |

### applications
| Column | Type |
|---|---|
| id | UUID (PK) |
| name | VARCHAR |
| client_id | VARCHAR |
| client_secret | VARCHAR |
| redirect_uri | TEXT |
| created_at | TIMESTAMP |

### auth_codes
| Column | Type |
|---|---|
| id | UUID (PK) |
| code | TEXT |
| application_id | UUID (FK) |
| user_id | UUID (FK) |
| expires_at | TIMESTAMP |
| created_at | TIMESTAMP |

---

## Assumptions and Limitations

- Passwords are hashed with SHA-256. For production use, `bcrypt` is recommended.
- Auth codes expire in 60 seconds and are single-use.
- No refresh token support yet — access tokens expire in 1 hour.
- ISSUER is hardcoded to `http://localhost:PORT` — update for production deployment.
- No email verification flow implemented yet.
- Admin registration endpoint is unprotected — add admin auth before deploying publicly.