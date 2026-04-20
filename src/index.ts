import 'dotenv/config';
import express from 'express';

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

app.listen(PORT, () => {
    console.log(`Auth server is running on port ${PORT}`);
});
