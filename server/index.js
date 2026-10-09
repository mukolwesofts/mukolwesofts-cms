require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { createDb } = require('./db');
const { createAuthRouter } = require('./auth');
const { SqliteStore } = require('./session-store');
const projectsRouter = require('./routes/projects');
const profileRouter = require('./routes/profile');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

async function createApp({ dbUrl, sessionSecret } = {}) {
    const db = await createDb(
        dbUrl || process.env.DATABASE_URL || `file:${path.join(__dirname, '..', 'data', 'app.db')}`
    );
    const secret =
        sessionSecret ||
        process.env.SESSION_SECRET ||
        (isProd ? null : 'insecure-dev-secret-change-me');

    if (!secret) {
        throw new Error('SESSION_SECRET must be set in production');
    }
    if (secret === 'insecure-dev-secret-change-me') {
        console.warn('[warn] SESSION_SECRET not set — using an insecure dev default');
    }

    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    const cspDirectives = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
    };
    // Only upgrade to https when actually deployed over TLS — otherwise local
    // dev over http://localhost would try to fetch assets via https.
    if (!isProd) cspDirectives.upgradeInsecureRequests = null;

    app.use(helmet({ contentSecurityPolicy: { directives: cspDirectives } }));

    app.use(express.json({ limit: '100kb' }));

    app.use(
        session({
            name: 'mkw.sid',
            store: new SqliteStore(db),
            secret,
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                sameSite: 'lax',
                secure: isProd,
                maxAge: 8 * 60 * 60 * 1000,
            },
        })
    );

    app.use('/api', createAuthRouter(db));
    app.use('/api', projectsRouter(db));
    app.use('/api', profileRouter(db));

    app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

    app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
    app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

    // Terminal-styled 404 for anything that fell through
    app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html')));

    // JSON error handler
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        if (err.type === 'entity.parse.failed') {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    });

    return { app, db };
}

if (require.main === module) {
    const port = Number(process.env.PORT) || 3000;
    createApp()
        .then(({ app }) => {
            app.listen(port, () => {
                console.log(`mukolwesofts listening on http://localhost:${port}`);
            });
        })
        .catch((err) => {
            console.error('Failed to start:', err);
            process.exit(1);
        });
}

module.exports = { createApp };
