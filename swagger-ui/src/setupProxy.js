const {createProxyMiddleware} = require('http-proxy-middleware');

const localHostProxy = createProxyMiddleware({
  target: 'https://sentry.io',
  changeOrigin: true,
});

module.exports = function (app) {
  app.use('/api', localHostProxy);
};
