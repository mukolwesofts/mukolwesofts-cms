const express = require('express');
const { z } = require('zod');
const { requireAuth, csrfHeader } = require('../auth');
const { ah } = require('../http');
const { uniqueSlug } = require('../db');

const urlField = z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || /^https?:\/\//i.test(v), {
        message: 'URL must start with http:// or https://',
    })
    .default('');

const tagItem = z.string().trim().min(1).max(30);

const projectSchema = z.object({
    name: z.string().trim().min(1, 'name is required').max(60),
    description: z.string().trim().min(1, 'description is required').max(240),
    tags: z.union([z.array(tagItem).max(8, 'maximum 8 tags'), z.string().max(300)]).default([]),
    github_url: urlField,
    live_url: urlField,
    featured: z.boolean().default(false),
});

const reorderSchema = z.object({
    ids: z.array(z.number().int().positive()).min(1).max(500),
});

function normalizeTags(tags) {
    const list = Array.isArray(tags)
        ? tags
        : String(tags)
              .split(',')
              .map((t) => t.trim());
    return list.filter(Boolean).slice(0, 8).join(', ');
}

function rowToJson(row) {
    return {
        ...row,
        tags: row.tags
            ? row.tags
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
            : [],
        featured: !!row.featured,
    };
}

module.exports = function projectsRouter(db) {
    const router = express.Router();
    const admin = [requireAuth, csrfHeader];

    // Public: list all projects
    router.get(
        '/projects',
        ah(async (req, res) => {
            const { rows } = await db.execute(
                'SELECT * FROM projects ORDER BY sort_order ASC, created_at DESC, id DESC'
            );
            res.json(rows.map(rowToJson));
        })
    );

    // Admin: reorder — must be registered before /:id
    router.put(
        '/projects/reorder',
        admin,
        ah(async (req, res) => {
            const parsed = reorderSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: parsed.error.issues[0].message });
            }
            await db.batch(
                parsed.data.ids.map((id, i) => ({
                    sql: 'UPDATE projects SET sort_order = ? WHERE id = ?',
                    args: [i, id],
                })),
                'write'
            );
            res.json({ ok: true });
        })
    );

    // Admin: create
    router.post(
        '/projects',
        admin,
        ah(async (req, res) => {
            const parsed = projectSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: parsed.error.issues[0].message });
            }
            const p = parsed.data;
            const { rows } = await db.execute(
                'SELECT COALESCE(MAX(sort_order), -1) AS max FROM projects'
            );
            const info = await db.execute({
                sql: `INSERT INTO projects (name, slug, description, tags, github_url, live_url, featured, sort_order)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    p.name,
                    await uniqueSlug(db, p.name),
                    p.description,
                    normalizeTags(p.tags),
                    p.github_url,
                    p.live_url,
                    p.featured ? 1 : 0,
                    Number(rows[0].max) + 1,
                ],
            });
            const { rows: created } = await db.execute({
                sql: 'SELECT * FROM projects WHERE id = ?',
                args: [Number(info.lastInsertRowid)],
            });
            res.status(201).json(rowToJson(created[0]));
        })
    );

    // Admin: update
    router.put(
        '/projects/:id',
        admin,
        ah(async (req, res) => {
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id < 1) {
                return res.status(400).json({ error: 'Invalid project id' });
            }
            const { rows: existing } = await db.execute({
                sql: 'SELECT * FROM projects WHERE id = ?',
                args: [id],
            });
            if (!existing.length) return res.status(404).json({ error: 'Project not found' });

            const parsed = projectSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: parsed.error.issues[0].message });
            }
            const p = parsed.data;
            const slug =
                existing[0].name === p.name ? existing[0].slug : await uniqueSlug(db, p.name, id);
            await db.execute({
                sql: `UPDATE projects
                  SET name = ?, slug = ?, description = ?, tags = ?, github_url = ?, live_url = ?,
                      featured = ?, updated_at = datetime('now')
                  WHERE id = ?`,
                args: [
                    p.name,
                    slug,
                    p.description,
                    normalizeTags(p.tags),
                    p.github_url,
                    p.live_url,
                    p.featured ? 1 : 0,
                    id,
                ],
            });
            const { rows } = await db.execute({
                sql: 'SELECT * FROM projects WHERE id = ?',
                args: [id],
            });
            res.json(rowToJson(rows[0]));
        })
    );

    // Admin: delete
    router.delete(
        '/projects/:id',
        admin,
        ah(async (req, res) => {
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id < 1) {
                return res.status(400).json({ error: 'Invalid project id' });
            }
            const info = await db.execute({
                sql: 'DELETE FROM projects WHERE id = ?',
                args: [id],
            });
            if (info.rowsAffected === 0)
                return res.status(404).json({ error: 'Project not found' });
            res.json({ ok: true });
        })
    );

    return router;
};
