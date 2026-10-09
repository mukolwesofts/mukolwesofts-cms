const session = require('express-session');

// Minimal SQLite-backed session store — sessions survive server restarts.
class SqliteStore extends session.Store {
    constructor(db, ttlMs = 8 * 60 * 60 * 1000) {
        super();
        this.ttlMs = ttlMs;
        db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid     TEXT PRIMARY KEY,
        sess    TEXT NOT NULL,
        expires INTEGER NOT NULL
      )
    `);
        this.getStmt = db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?');
        this.setStmt = db.prepare(
            `INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`
        );
        this.delStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
        this.touchStmt = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
        this.cleanStmt = db.prepare('DELETE FROM sessions WHERE expires < ?');

        this.sweeper = setInterval(
            () => {
                this.cleanStmt.run(Date.now());
            },
            15 * 60 * 1000
        );
        this.sweeper.unref();
    }

    expires(sess) {
        const exp = sess && sess.cookie && sess.cookie.expires;
        return exp ? new Date(exp).getTime() : Date.now() + this.ttlMs;
    }

    get(sid, cb) {
        try {
            const row = this.getStmt.get(sid);
            if (!row || row.expires < Date.now()) return cb(null, null);
            cb(null, JSON.parse(row.sess));
        } catch (err) {
            cb(err);
        }
    }

    set(sid, sess, cb) {
        try {
            this.setStmt.run(sid, JSON.stringify(sess), this.expires(sess));
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
        }
    }

    touch(sid, sess, cb) {
        try {
            this.touchStmt.run(this.expires(sess), sid);
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
        }
    }

    destroy(sid, cb) {
        try {
            this.delStmt.run(sid);
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
        }
    }
}

module.exports = { SqliteStore };
