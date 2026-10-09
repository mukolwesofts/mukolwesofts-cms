const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { getSetting, setSetting } = require('./db');

const loginSchema = z.object({
    password: z.string().min(1, 'password is required').max(200),
});

const changePasswordSchema = z.object({
    current_password: z.string().min(1, 'current password is required').max(200),
    new_password: z
        .string()
        .min(8, 'new password must be at least 8 characters')
        .max(200),
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

const passwordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

function requireAuth(req, res, next) {
    if (req.session && req.session.authed) return next();
    return res.status(401).json({ error: 'Not authenticated' });
}

// CSRF: mutating admin requests must send a custom header. Combined with the
// SameSite=Lax session cookie, a cross-site form/fetch cannot satisfy this.
function csrfHeader(req, res, next) {
    if (req.get('x-requested-with') === 'fetch') return next();
    return res.status(403).json({ error: 'Missing or invalid request header' });
}

function createAuthRouter(db) {
    const router = express.Router();

    // Hash lives in the DB once changed via /admin/password; the env var is the
    // initial fallback so first deploy works before any change.
    const currentHash = () =>
        getSetting(db, 'admin_password_hash') || process.env.ADMIN_PASSWORD_HASH;

    router.post('/admin/login', loginLimiter, async (req, res) => {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.issues[0].message });
        }
        const hash = currentHash();
        if (!hash) {
            return res.status(500).json({ error: 'Admin login is not configured on this server' });
        }
        const ok = await bcrypt.compare(parsed.data.password, hash);
        if (!ok) {
            return res.status(401).json({ error: 'Wrong password' });
        }
        req.session.regenerate((err) => {
            if (err) return res.status(500).json({ error: 'Could not create session' });
            req.session.authed = true;
            res.json({ ok: true });
        });
    });

    router.post('/admin/logout', (req, res) => {
        req.session.destroy(() => {
            res.clearCookie('mkw.sid');
            res.json({ ok: true });
        });
    });

    router.get('/admin/me', (req, res) => {
        if (req.session && req.session.authed) return res.json({ authed: true });
        return res.status(401).json({ error: 'Not authenticated' });
    });

    router.post(
        '/admin/password',
        requireAuth,
        csrfHeader,
        passwordLimiter,
        async (req, res) => {
            const parsed = changePasswordSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: parsed.error.issues[0].message });
            }
            const hash = currentHash();
            const ok = hash && (await bcrypt.compare(parsed.data.current_password, hash));
            if (!ok) {
                return res.status(401).json({ error: 'Current password is wrong' });
            }
            setSetting(db, 'admin_password_hash', await bcrypt.hash(parsed.data.new_password, 12));
            // Rotate the session so a stolen old session id dies with the password change
            req.session.regenerate((err) => {
                if (err) return res.status(500).json({ error: 'Could not refresh session' });
                req.session.authed = true;
                res.json({ ok: true });
            });
        }
    );

    return router;
}

module.exports = { createAuthRouter, requireAuth, csrfHeader };
