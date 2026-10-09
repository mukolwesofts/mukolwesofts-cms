// Express 4 doesn't forward rejections from async handlers to the error
// middleware — wrap them.
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ah };
