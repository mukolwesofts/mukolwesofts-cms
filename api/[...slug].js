const { createApp } = require('../server/index');

// Vercel serverless entry — handles every /api/* request. The Express app (and
// its Turso connection) is created once per cold start and reused.
let appPromise;

module.exports = async (req, res) => {
    appPromise = appPromise || createApp().then(({ app }) => app);
    const app = await appPromise;
    app(req, res);
};
