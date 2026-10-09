const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

async function migrate(db) {
    await db.batch(
        [
            `CREATE TABLE IF NOT EXISTS projects (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        slug        TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        tags        TEXT NOT NULL DEFAULT '',
        github_url  TEXT NOT NULL DEFAULT '',
        live_url    TEXT NOT NULL DEFAULT '',
        featured    INTEGER NOT NULL DEFAULT 0,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
            `CREATE TABLE IF NOT EXISTS profile (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        headline   TEXT NOT NULL DEFAULT '',
        about_text TEXT NOT NULL DEFAULT '',
        role       TEXT NOT NULL DEFAULT '',
        stack      TEXT NOT NULL DEFAULT '',
        location   TEXT NOT NULL DEFAULT '',
        status     TEXT NOT NULL DEFAULT '',
        email      TEXT NOT NULL DEFAULT '',
        whatsapp   TEXT NOT NULL DEFAULT '',
        github_url TEXT NOT NULL DEFAULT '',
        github_org_url TEXT NOT NULL DEFAULT ''
      )`,
            `CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
            `CREATE TABLE IF NOT EXISTS sessions (
        sid     TEXT PRIMARY KEY,
        sess    TEXT NOT NULL,
        expires INTEGER NOT NULL
      )`,
        ],
        'write'
    );

    // Lightweight migrations for DBs created before a column existed
    const { rows: cols } = await db.execute('PRAGMA table_info(profile)');
    const names = cols.map((c) => c.name);
    if (!names.includes('whatsapp')) {
        await db.execute("ALTER TABLE profile ADD COLUMN whatsapp TEXT NOT NULL DEFAULT ''");
    }
    if (!names.includes('github_org_url')) {
        await db.execute("ALTER TABLE profile ADD COLUMN github_org_url TEXT NOT NULL DEFAULT ''");
    }
}

async function seed(db) {
    const { rows } = await db.execute('SELECT COUNT(*) AS n FROM projects');
    if (Number(rows[0].n) === 0) {
        const projects = [
            {
                name: 'Common Goal Research',
                description:
                    'WordPress site for a Nairobi research and consulting organisation — ' +
                    'publications, projects and donations.',
                tags: 'wordpress',
                github_url: '',
                live_url: 'https://commongoalresearch.org/',
                featured: 0,
            },
            {
                name: 'Sally Trends',
                description:
                    "WooCommerce store for a Nairobi fashion brand — women's and kids' " +
                    'clothing, M-Pesa and cash on delivery.',
                tags: 'wordpress, woocommerce',
                github_url: '',
                live_url: 'https://sallytrends.co.ke/',
                featured: 1,
            },
            {
                name: 'shamba-tracker',
                description:
                    'Farm record keeping for smallholders — fields, inputs, harvests and sales in one place.',
                tags: 'node, express, sqlite',
                github_url: 'https://github.com/mukolwesofts/shamba-tracker',
                live_url: 'https://shamba-tracker.example.com',
                featured: 1,
            },
            {
                name: 'duka-pos',
                description:
                    'Offline-first point of sale for neighbourhood shops. Syncs when the network comes back.',
                tags: 'javascript, pwa, indexeddb',
                github_url: 'https://github.com/mukolwesofts/duka-pos',
                live_url: '',
                featured: 1,
            },
            {
                name: 'kazi-board',
                description: 'A tiny kanban for tracking gigs, invoices and job applications.',
                tags: 'vanilla-js, css',
                github_url: 'https://github.com/mukolwesofts/kazi-board',
                live_url: 'https://kazi-board.example.com',
                featured: 0,
            },
            {
                name: 'term-portfolio',
                description:
                    'This site — a terminal-styled portfolio with a small custom CMS behind it.',
                tags: 'express, sqlite, zod',
                github_url: 'https://github.com/mukolwesofts/term-portfolio',
                live_url: '',
                featured: 0,
            },
        ];
        await db.batch(
            projects.map((p, i) => ({
                sql: `INSERT INTO projects (name, slug, description, tags, github_url, live_url, featured, sort_order)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    p.name,
                    slugify(p.name),
                    p.description,
                    p.tags,
                    p.github_url,
                    p.live_url,
                    p.featured,
                    i,
                ],
            })),
            'write'
        );
    }

    const { rows: profiles } = await db.execute('SELECT COUNT(*) AS n FROM profile');
    if (Number(profiles[0].n) === 0) {
        await db.execute({
            sql: `INSERT INTO profile (id, headline, about_text, role, stack, location, status, email, whatsapp, github_url, github_org_url)
                  VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                'Web Development Expert — ' +
                    'driving scalable, secure & high-performance web apps',
                "I'm a full-stack developer based in Nairobi, Kenya, working with " +
                    'Laravel, PHP, React, Vue.js and JavaScript. I build business websites ' +
                    "and web apps — currently mukolwesofts.com — and I'm learning DevOps " +
                    'and the Laravel + Vue3 + Inertia stack. Off the clock: Chelsea fan, ' +
                    'Marvel + DC comics.',
                'Full Stack Engineer @ Career Now Brands',
                'Laravel, PHP, JavaScript, React, Vue.js, Node.js, MySQL',
                'Nairobi, Kenya',
                'building mukolwesofts.com',
                'molukakadev@gmail.com',
                '+254719692332',
                'https://github.com/mukolweke',
                'https://github.com/mukolwesofts',
            ],
        });
    }
}

// dbUrl is a libsql URL: 'file:./data/app.db' for local dev,
// 'libsql://…turso.io' (+ TURSO_AUTH_TOKEN) in production, ':memory:' in tests.
async function createDb(dbUrl) {
    if (dbUrl.startsWith('file:')) {
        const filePath = dbUrl.slice('file:'.length);
        fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
    }
    const db = createClient({
        url: dbUrl,
        authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
    await migrate(db);
    await seed(db);
    return db;
}

function slugify(name) {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return slug || 'project';
}

async function uniqueSlug(db, name, excludeId = null) {
    const base = slugify(name);
    const sql = excludeId
        ? 'SELECT id FROM projects WHERE slug = ? AND id != ?'
        : 'SELECT id FROM projects WHERE slug = ?';
    let slug = base;
    let i = 2;
    for (;;) {
        const args = excludeId ? [slug, excludeId] : [slug];
        const { rows } = await db.execute({ sql, args });
        if (rows.length === 0) return slug;
        slug = `${base}-${i++}`;
    }
}

async function getSetting(db, key) {
    const { rows } = await db.execute({
        sql: 'SELECT value FROM settings WHERE key = ?',
        args: [key],
    });
    return rows.length ? rows[0].value : null;
}

async function setSetting(db, key, value) {
    await db.execute({
        sql: `INSERT INTO settings (key, value) VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        args: [key, value],
    });
}

module.exports = { createDb, slugify, uniqueSlug, getSetting, setSetting };
