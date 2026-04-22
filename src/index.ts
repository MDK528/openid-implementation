import 'dotenv/config';
import express from 'express';
import jose from "node-jose"
import { PRIVATE_KEY, PUBLIC_KEY } from './utils/cert.js';
import path from 'node:path';
import { db } from './db/index.js';
import { usersTable } from './db/schema.js';
import { eq } from 'drizzle-orm';
import type { JWTClaims } from './utils/user-token.js';
import Jwt from 'jsonwebtoken';

const app = express();

const PORT = process.env.PORT || 8000;

app.use(express.json())
app.use(express.static(path.resolve('public')))

app.get('/', (req, res) => {
    res.json({ message: 'Hello, this is the auth server!' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// OIDC Endpoints

app.get('/.well-known/openid-configuration', (req, res)=>{
    const ISSUER = `http://localhost:${PORT}`
    return res.json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/o/authenticate`,
        userinfo_endpoint: `${ISSUER}/o/userinfo`,
        jwks_uri: `${ISSUER}/.well-known/jwks.json`
    })
});

app.get('/.well-known/jwks.json', async (req, res) => {
    const key = await jose.JWK.asKey(PUBLIC_KEY, 'pem')
    
    return res.json({
        keys: [key.toJSON()]
    })
});

app.get('/o/authenticate', async (req, res) => {
    return res.sendFile(path.resolve('public', 'authenticate.html'))
});

app.get('/o/authenticate/login', async (req, res) => {
    const {email, password} = req.body

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and Password are required" 
        })
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email))

    
    if (!user?.email || !user?.password) {
        return res.status(401).json({
            message: "Inavlid email or password"
        })
    }

    const ISSUER = `http://localhost:${PORT}`;
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
    } 
    
    const token = Jwt.sign(claims, PRIVATE_KEY, {algorithm: "RS256"})

    res.json({token})

});

app.listen(PORT, () => {
    console.log(`Auth server is running on port ${PORT}`);
});