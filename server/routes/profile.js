const express = require('express');
const { z } = require('zod');
const { requireAuth, csrfHeader } = require('../auth');
const { ah } = require('../http');

const profileSchema = z.object({
    headline: z.string().trim().max(120).default(''),
    about_text: z.string().trim().max(4000).default(''),
    role: z.string().trim().max(80).default(''),
    stack: z.string().trim().max(200).default(''),
    location: z.string().trim().max(80).default(''),
    status: z.string().trim().max(80).default(''),
    email: z
        .string()
        .trim()
        .max(120)
        .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
            message: 'email must be a valid address or empty',
        })
        .default(''),
    whatsapp: z
        .string()
        .trim()
        .max(30)
        .refine((v) => v === '' || /^\+?[0-9()\-\s]+$/.test(v), {
            message: 'whatsapp must be a phone number or empty',
        })
        .default(''),
    github_url: z
        .string()
        .trim()
        .max(500)
        .refine((v) => v === '' || /^https?:\/\//i.test(v), {
            message: 'github_url must start with http:// or https://',
        })
        .default(''),
    github_org_url: z
        .string()
        .trim()
        .max(500)
        .refine((v) => v === '' || /^https?:\/\//i.test(v), {
            message: 'github_org_url must start with http:// or https://',
        })
        .default(''),
});

module.exports = function profileRouter(db) {
    const router = express.Router();

    // Public
    router.get(
        '/profile',
        ah(async (req, res) => {
            const { rows } = await db.execute('SELECT * FROM profile WHERE id = 1');
            res.json(rows[0] || {});
        })
    );

    // Admin
    router.put(
        '/profile',
        requireAuth,
        csrfHeader,
        ah(async (req, res) => {
            const parsed = profileSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: parsed.error.issues[0].message });
            }
            const p = parsed.data;
            await db.execute({
                sql: `INSERT INTO profile (id, headline, about_text, role, stack, location, status, email, whatsapp, github_url, github_org_url)
                  VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    headline = excluded.headline, about_text = excluded.about_text,
                    role = excluded.role, stack = excluded.stack,
                    location = excluded.location, status = excluded.status,
                    email = excluded.email, whatsapp = excluded.whatsapp,
                    github_url = excluded.github_url, github_org_url = excluded.github_org_url`,
                args: [
                    p.headline,
                    p.about_text,
                    p.role,
                    p.stack,
                    p.location,
                    p.status,
                    p.email,
                    p.whatsapp,
                    p.github_url,
                    p.github_org_url,
                ],
            });
            const { rows } = await db.execute('SELECT * FROM profile WHERE id = 1');
            res.json(rows[0]);
        })
    );

    return router;
};
