const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { createApp } = require('../server/index.js');

let server;
let base;
let cookie = '';

async function api(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(base + path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'fetch',
            ...(cookie ? { Cookie: cookie } : {}),
            ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        /* empty body */
    }
    return { status: res.status, data };
}

before(async () => {
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('hunter2', 4);
    const { app } = createApp({ dbPath: ':memory:', sessionSecret: 'test-secret' });
    await new Promise((resolve) => {
        server = app.listen(0, resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server && server.close());

test('api', async (t) => {
    await t.test('GET /api/projects returns seeded projects', async () => {
        const { status, data } = await api('/api/projects');
        assert.equal(status, 200);
        assert.equal(data.length, 6);
        assert.equal(data[0].slug, 'common-goal-research');
        assert.ok(Array.isArray(data[0].tags));
        assert.equal(typeof data[0].featured, 'boolean');
    });

    await t.test('GET /api/profile returns the profile', async () => {
        const { status, data } = await api('/api/profile');
        assert.equal(status, 200);
        assert.equal(data.email, 'molukakadev@gmail.com');
        assert.equal(data.whatsapp, '+254719692332');
    });

    await t.test('login with wrong password fails', async () => {
        const { status, data } = await api('/api/admin/login', {
            method: 'POST',
            body: { password: 'wrong' },
        });
        assert.equal(status, 401);
        assert.match(data.error, /wrong password/i);
    });

    await t.test('admin routes reject unauthenticated requests', async () => {
        const { status } = await api('/api/projects', {
            method: 'POST',
            body: { name: 'x', description: 'y' },
        });
        assert.equal(status, 401);
    });

    await t.test('login with correct password sets a session', async () => {
        const { status } = await api('/api/admin/login', {
            method: 'POST',
            body: { password: 'hunter2' },
        });
        assert.equal(status, 200);
        assert.ok(cookie.includes('mkw.sid'));
        const me = await api('/api/admin/me');
        assert.equal(me.status, 200);
        assert.equal(me.data.authed, true);
    });

    await t.test('mutating without the CSRF header is rejected', async () => {
        const { status } = await api('/api/projects', {
            method: 'POST',
            body: { name: 'x', description: 'y' },
            headers: { 'X-Requested-With': '' },
        });
        assert.equal(status, 403);
    });

    let createdId;

    await t.test('create validates input', async () => {
        const missing = await api('/api/projects', {
            method: 'POST',
            body: { description: 'no name' },
        });
        assert.equal(missing.status, 400);

        const badUrl = await api('/api/projects', {
            method: 'POST',
            body: { name: 'x', description: 'y', github_url: 'ftp://nope' },
        });
        assert.equal(badUrl.status, 400);
        assert.match(badUrl.data.error, /http/);

        const tooManyTags = await api('/api/projects', {
            method: 'POST',
            body: { name: 'x', description: 'y', tags: Array(9).fill('t') },
        });
        assert.equal(tooManyTags.status, 400);
    });

    await t.test('create project works', async () => {
        const { status, data } = await api('/api/projects', {
            method: 'POST',
            body: {
                name: 'Test Project',
                description: 'made by the test suite',
                tags: ['test', 'api'],
                github_url: 'https://github.com/mukolwesofts/test',
                live_url: '',
                featured: false,
            },
        });
        assert.equal(status, 201);
        assert.equal(data.slug, 'test-project');
        assert.deepEqual(data.tags, ['test', 'api']);
        createdId = data.id;
    });

    await t.test('update project works', async () => {
        const { status, data } = await api(`/api/projects/${createdId}`, {
            method: 'PUT',
            body: {
                name: 'Test Project Renamed',
                description: 'updated',
                tags: ['renamed'],
                github_url: '',
                live_url: 'https://example.com',
                featured: true,
            },
        });
        assert.equal(status, 200);
        assert.equal(data.slug, 'test-project-renamed');
        assert.equal(data.featured, true);
    });

    await t.test('reorder changes list order', async () => {
        const before = await api('/api/projects');
        const ids = before.data.map((p) => p.id).reverse();
        const { status } = await api('/api/projects/reorder', {
            method: 'PUT',
            body: { ids },
        });
        assert.equal(status, 200);
        const afterReorder = await api('/api/projects');
        assert.deepEqual(
            afterReorder.data.map((p) => p.id),
            ids
        );
    });

    await t.test('delete project works', async () => {
        const { status } = await api(`/api/projects/${createdId}`, { method: 'DELETE' });
        assert.equal(status, 200);
        const list = await api('/api/projects');
        assert.equal(list.data.length, 6);
    });

    await t.test('PUT /api/profile updates content', async () => {
        const { status, data } = await api('/api/profile', {
            method: 'PUT',
            body: {
                headline: 'new headline',
                about_text: 'updated about',
                role: 'dev',
                stack: 'node',
                location: 'Nairobi',
                status: 'busy',
                email: 'me@example.com',
                whatsapp: '+254700000000',
                github_url: 'https://github.com/x',
            },
        });
        assert.equal(status, 200);
        assert.equal(data.headline, 'new headline');
        const pub = await api('/api/profile');
        assert.equal(pub.data.email, 'me@example.com');
        assert.equal(pub.data.whatsapp, '+254700000000');
    });

    await t.test('logout ends the session', async () => {
        const { status } = await api('/api/admin/logout', { method: 'POST' });
        assert.equal(status, 200);
        const me = await api('/api/admin/me');
        assert.equal(me.status, 401);
    });

    await t.test('change password flow', async () => {
        const relogin = await api('/api/admin/login', {
            method: 'POST',
            body: { password: 'hunter2' },
        });
        assert.equal(relogin.status, 200);

        const wrongCurrent = await api('/api/admin/password', {
            method: 'POST',
            body: { current_password: 'nope', new_password: 'newpassword99' },
        });
        assert.equal(wrongCurrent.status, 401);

        const tooShort = await api('/api/admin/password', {
            method: 'POST',
            body: { current_password: 'hunter2', new_password: 'short' },
        });
        assert.equal(tooShort.status, 400);

        const change = await api('/api/admin/password', {
            method: 'POST',
            body: { current_password: 'hunter2', new_password: 'newpassword99' },
        });
        assert.equal(change.status, 200);

        await api('/api/admin/logout', { method: 'POST' });
        const loginWithNew = await api('/api/admin/login', {
            method: 'POST',
            body: { password: 'newpassword99' },
        });
        assert.equal(loginWithNew.status, 200);
    });
});
