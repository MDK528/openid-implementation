import 'dotenv/config';
import express from 'express';
import jose from "node-jose"
import { PRIVATE_KEY, PUBLIC_KEY } from './utils/cert.js';

const app = express();

const PORT = process.env.PORT || 8000;

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
        authorization_endpoint: `${ISSUER}/o/auth`,
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

app.listen(PORT, () => {
    console.log(`Auth server is running on port ${PORT}`);
});
