const { route } = require('../server');

module.exports = async (req, res) => {
  try {
    await route(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: { message: 'Internal server error' } }));
    }
  }
};

