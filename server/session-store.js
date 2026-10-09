const session = require('express-session');

// SQLite/libsql-backed session store — sessions survive restarts and work in
// serverless deployments (Turso). The `sessions` table is created by db.migrate.
class SqliteStore extends session.Store {
    constructor(db, ttlMs = 8 * 60 * 60 * 1000) {
        super();
        this.db = db;
        this.ttlMs = ttlMs;
    }

    expires(sess) {
        const exp = sess && sess.cookie && sess.cookie.expires;
        return exp ? new Date(exp).getTime() : Date.now() + this.ttlMs;
    }

    get(sid, cb) {
        this.db
            .execute({ sql: 'SELECT sess, expires FROM sessions WHERE sid = ?', args: [sid] })
            .then(({ rows }) => {
                const row = rows[0];
                if (!row || Number(row.expires) < Date.now()) return cb(null, null);
                cb(null, JSON.parse(row.sess));
            })
            .catch(cb);
    }

    set(sid, sess, cb) {
        this.db
            .execute({
                sql: `INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
                      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`,
                args: [sid, JSON.stringify(sess), this.expires(sess)],
            })
            .then(() => cb && cb(null))
            .catch((err) => cb && cb(err));
    }

    touch(sid, sess, cb) {
        this.db
            .execute({
                sql: 'UPDATE sessions SET expires = ? WHERE sid = ?',
                args: [this.expires(sess), sid],
            })
            .then(() => cb && cb(null))
            .catch((err) => cb && cb(err));
    }

    destroy(sid, cb) {
        this.db
            .execute({ sql: 'DELETE FROM sessions WHERE sid = ?', args: [sid] })
            .then(() => cb && cb(null))
            .catch((err) => cb && cb(err));
    }
}

module.exports = { SqliteStore };
