import 'dotenv/config';
import express from 'express';
import jose from "node-jose"
import { PRIVATE_KEY, PUBLIC_KEY } from './utils/cert.js';
import path from 'node:path';
import { db } from './db/index.js';
import { usersTable } from './db/schema.js';
import { applicationsTable } from './db/application.js';
import { authCodesTable } from './db/authCode.js';
import { and, eq } from 'drizzle-orm';
import type { JWTClaims } from './utils/user-token.js';
import Jwt from 'jsonwebtoken';
import crypto from "node:crypto"

const app = express();

const PORT = process.env.PORT || 8000;
const ISSUER = `http://localhost:${PORT}`;

function generateAuthCode() {
    return crypto.randomBytes(24).toString('hex');
}

function createJwtToken(user: any) {
    const now = Math.floor(Date.now() / 1000);

    const claims: JWTClaims = {
        iss: ISSUER,
        sub: user.id,
        email: user.email,
        email_verified: String(user.emailVerified),
        exp: now + 3600,
        given_name: user.firstName ?? "",
        family_name: user.lastName ?? "",
        name: [user.firstName, user.lastName].filter(Boolean).join(" "),
        picture: user.profileImageURL ?? ""
    };

    return Jwt.sign(claims, PRIVATE_KEY, { algorithm: "RS256" });
}

app.use(express.json())
app.use(express.static(path.resolve('public')))

app.get('/', (req, res) => {
    res.json({ message: 'Hello, this is the auth server!' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/.well-known/openid-configuration', (req, res) => {
    const ISSUER = `http://localhost:${PORT}`
    return res.json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/o/authenticate`,
        userinfo_endpoint: `${ISSUER}/o/userinfo`,
        jwks_uri: `${ISSUER}/.well-known/jwks.json`,
        token_endpoint: `${ISSUER}/o/authenticate/tokeninfo`
    })
});

app.get('/.well-known/jwks.json', async (req, res) => {
    const key = await jose.JWK.asKey(PUBLIC_KEY, 'pem')

    return res.json({
        keys: [key.toJSON()]
    })
});

app.get('/o/authenticate/client-info', async (req, res) => {
    const clientId = String(req.query.client_id || '');

    if (!clientId) {
        return res.status(400).json({ message: 'client_id is required' });
    }

    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clientId, clientId));

    if (!application) {
        return res.status(404).json({ message: 'Application not found' });
    }

    res.json({
        applicationName: application.applicationName,
        redirectUri: application.redirectUri,
        clientId: application.clientId,
    });
});

app.get('/o/authenticate', async (req, res) => {
    const clientId = String(req.query.client_id || '');
    const redirectUri = String(req.query.redirect_uri || '');

    if (!clientId) {
        return res.status(400).json({ message: 'client_id is required' });
    }

    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clientId, clientId));

    if (!application) {
        return res.status(404).json({ message: 'Unknown client_id' });
    }

    if (redirectUri && application.redirectUri !== redirectUri) {
        return res.status(400).json({ message: 'redirect_uri does not match registered application' });
    }

    return res.sendFile(path.resolve('public', 'authenticate.html'));
});

app.get('/o/admin/applications/register', async (req, res) => {
    return res.sendFile(path.resolve('public', 'admin-register.html'));
});

app.post('/o/admin/applications/register', async (req, res) => {
    const { applicationName, redirectUri } = req.body;

    if (!applicationName || !redirectUri) {
        return res.status(400).json({ message: 'applicationName and redirectUri are required' });
    }

    const clientId = crypto.randomBytes(16).toString('hex');
    const clientSecret = crypto.randomBytes(32).toString('hex');

    const [application] = await db.insert(applicationsTable).values({
        applicationName,
        clientId,
        clientSecret,
        redirectUri,
    }).returning({
        id: applicationsTable.id,
        applicationName: applicationsTable.applicationName,
        clientId: applicationsTable.clientId,
        clientSecret: applicationsTable.clientSecret,
        redirectUri: applicationsTable.redirectUri,
    });

    res.status(201).json({
        message: 'Application registered',
        data: application,
    });
});

app.post("/o/authenticate/register", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!email || !password || !firstName) {
    res
      .status(400)
      .json({ message: "First name, email, and password are required." });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing) {
    res
      .status(409)
      .json({ message: "An account with this email already exists." });
    return;
  }

  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

  await db.insert(usersTable).values({
    firstName,
    lastName: lastName ?? null,
    email,
    password:hashedPassword,
  });

  res.status(201).json({ ok: true });
});

app.post('/o/authenticate/login', async (req, res) => {
    const { email, password, client_id, redirect_uri, state } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and Password are required' });
    }

    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const [user] = await db.select().from(usersTable).where(and(
        eq(usersTable.email, email),
        eq(usersTable.password, hashedPassword),
    ));

    if (!user?.email || !user?.password) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (client_id) {
        const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clientId, String(client_id)));

        if (!application) {
            return res.status(400).json({ message: 'Invalid client_id' });
        }

        if (redirect_uri && application.redirectUri !== String(redirect_uri)) {
            return res.status(400).json({ message: 'redirect_uri does not match registered application' });
        }

        const code = generateAuthCode();
        const expiresAt = new Date(Date.now() + 60 * 1000);

        await db.insert(authCodesTable).values({
            code,
            applicationId: application.id,
            userId: user.id,
            expiresAt,
        });

        const redirectUrl = new URL(application.redirectUri);
        console.log('Redirect URL:', redirectUrl.toString());
        redirectUrl.searchParams.set('code', code);
        if (state) {
            redirectUrl.searchParams.set('state', String(state));
        }

        return res.json({ redirect: redirectUrl.toString() });
    }

    const token = createJwtToken(user);
    res.json({ token });
});

app.get('/o/userinfo', async (req, res) => {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Missing or Invalid Authorization header"
        })
    }

    const token = authHeader.slice(7)
    console.log(token);

    let claims: JWTClaims;

    try {
        claims = Jwt.verify(token, PUBLIC_KEY, { algorithms: ["RS256"] }) as JWTClaims
    } catch {
        res.status(401).json({ message: "Invalid or expired token." });
        return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, claims.sub)).limit(1)

    if (!user) {
        return res.status(404).json({
            message: "User not found."
        });
    }

    res.json({
        sub: user.id,
        email: user.email,
        email_verified: user.emailVerified,
        given_name: user.firstName,
        family_name: user.lastName,
        name: [user.firstName, user.lastName].filter(Boolean).join(" "),
        picture: user.profileImageURL
    })
});

app.post('/o/authenticate/tokeninfo', async (req, res) => {
    const { code, client_id, client_secret, redirect_uri } = req.body;

    if (!code || !client_id || !client_secret) {
        return res.status(400).json({ message: 'code, client_id and client_secret are required' });
    }

    const [application] = await db.select().from(applicationsTable).where(and(
        eq(applicationsTable.clientId, String(client_id)),
        eq(applicationsTable.clientSecret, String(client_secret)),
    ));

    if (!application) {
        return res.status(401).json({ message: 'Invalid client credentials' });
    }

    if (redirect_uri && application.redirectUri !== String(redirect_uri)) {
        return res.status(400).json({ message: 'redirect_uri does not match registered application' });
    }

    const [authCode] = await db.select().from(authCodesTable).where(eq(authCodesTable.code, String(code)));

    if (!authCode) {
        return res.status(400).json({ message: 'Invalid or expired code' });
    }

    if (authCode.applicationId !== application.id) {
        return res.status(400).json({ message: 'Authorization code does not belong to this application' });
    }

    if (new Date(authCode.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Authorization code has expired' });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, authCode.userId)).limit(1);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    await db.delete(authCodesTable).where(eq(authCodesTable.id, authCode.id));

    const token = createJwtToken(user);

    res.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: 3600,
    });
});

app.listen(PORT, () => {
    console.log(`Auth server is running on http://localhost:${PORT}`);
});