const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function migrate(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
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
    );

    CREATE TABLE IF NOT EXISTS profile (
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
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

    // Lightweight migrations for DBs created before a column existed
    const profileCols = db.prepare('PRAGMA table_info(profile)').all().map((c) => c.name);
    if (!profileCols.includes('whatsapp')) {
        db.exec("ALTER TABLE profile ADD COLUMN whatsapp TEXT NOT NULL DEFAULT ''");
    }
    if (!profileCols.includes('github_org_url')) {
        db.exec("ALTER TABLE profile ADD COLUMN github_org_url TEXT NOT NULL DEFAULT ''");
    }
}

function seed(db) {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM projects').get();
    if (n === 0) {
        const insert = db.prepare(`
      INSERT INTO projects (name, slug, description, tags, github_url, live_url, featured, sort_order)
      VALUES (@name, @slug, @description, @tags, @github_url, @live_url, @featured, @sort_order)
    `);
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
                description: 'Farm record keeping for smallholders — fields, inputs, harvests and sales in one place.',
                tags: 'node, express, sqlite',
                github_url: 'https://github.com/mukolwesofts/shamba-tracker',
                live_url: 'https://shamba-tracker.example.com',
                featured: 1,
            },
            {
                name: 'duka-pos',
                description: 'Offline-first point of sale for neighbourhood shops. Syncs when the network comes back.',
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
                description: 'This site — a terminal-styled portfolio with a small custom CMS behind it.',
                tags: 'express, sqlite, zod',
                github_url: 'https://github.com/mukolwesofts/term-portfolio',
                live_url: '',
                featured: 0,
            },
        ];
        const tx = db.transaction(() => {
            projects.forEach((p, i) => insert.run({ ...p, slug: slugify(p.name), sort_order: i }));
        });
        tx();
    }

    const { n: profiles } = db.prepare('SELECT COUNT(*) AS n FROM profile').get();
    if (profiles === 0) {
        db.prepare(`
      INSERT INTO profile (id, headline, about_text, role, stack, location, status, email, whatsapp, github_url, github_org_url)
      VALUES (1, @headline, @about_text, @role, @stack, @location, @status, @email, @whatsapp, @github_url, @github_org_url)
    `).run({
            headline:
                'Web Development Expert — ' +
                'driving scalable, secure & high-performance web apps',
            about_text:
                "I'm a full-stack developer based in Nairobi, Kenya, working with " +
                'Laravel, PHP, React, Vue.js and JavaScript. I build business websites ' +
                'and web apps — currently mukolwesofts.com — and I\'m learning DevOps ' +
                'and the Laravel + Vue3 + Inertia stack. Off the clock: Chelsea fan, ' +
                'Marvel + DC comics.',
            role: 'Full Stack Engineer @ Career Now Brands',
            stack: 'Laravel, PHP, JavaScript, React, Vue.js, Node.js, MySQL',
            location: 'Nairobi, Kenya',
            status: 'building mukolwesofts.com',
            email: 'molukakadev@gmail.com',
            whatsapp: '+254719692332',
            github_url: 'https://github.com/mukolweke',
            github_org_url: 'https://github.com/mukolwesofts',
        });
    }
}

function createDb(dbPath) {
    if (dbPath !== ':memory:') {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
    seed(db);
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

function uniqueSlug(db, name, excludeId = null) {
    const base = slugify(name);
    let slug = base;
    let i = 2;
    const find = excludeId
        ? db.prepare('SELECT id FROM projects WHERE slug = ? AND id != ?')
        : db.prepare('SELECT id FROM projects WHERE slug = ?');
    while (excludeId ? find.get(slug, excludeId) : find.get(slug)) {
        slug = `${base}-${i++}`;
    }
    return slug;
}

function getSetting(db, key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
}

function setSetting(db, key, value) {
    db.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(key, value);
}

module.exports = { createDb, slugify, uniqueSlug, getSetting, setSetting };
