/* eslint-env node */
/* eslint no-console:0 import/no-nodejs-modules:0 */
const http = require('http');
const httpProxy = require('http-proxy');

const WEBPACK_DEV_PORT = process.env.WEBPACK_DEV_PORT;
const WEBPACK_DEV_PROXY = process.env.WEBPACK_DEV_PROXY;
const SENTRY_DEVSERVER_PORT = process.env.SENTRY_DEVSERVER_PORT;

if (!WEBPACK_DEV_PORT || !WEBPACK_DEV_PROXY || !SENTRY_DEVSERVER_PORT) {
  console.error(
    'Invalid environment variables, requires: WEBPACK_DEV_PORT, WEBPACK_DEV_PROXY, SENTRY_DEVSERVER_PORT'
  );
  process.exit(1);
}

const createProxy = function(proxy, req, res, port, cb) {
  if (res.headersSent) {
    return;
  }

  proxy.web(req, res, {target: 'http://localhost:' + port}, function(e, r) {
    cb && cb(e, r);
    if (e) {
      setTimeout(function() {
        createProxy(proxy, req, res, port, cb);
      }, 1000);
    }
  });
};

const proxy = httpProxy.createProxyServer({});
const server = http.createServer(function(req, res) {
  try {
    const matches = req.url.match(/sentry\/dist\/(.*)$/);
    if (matches && matches.length) {
      req.url = `/${matches[1]}`;
      createProxy(proxy, req, res, WEBPACK_DEV_PORT, function(err) {
        if (err) console.log('webpack server not ready...');
      });
    } else {
      createProxy(proxy, req, res, SENTRY_DEVSERVER_PORT, function(err) {
        if (err) console.log('sentry server not ready...');
      });
    }
  } catch (err) {
    console.log('Proxy target not responding');
  }
});

server.on('error', function() {
  console.log('devproxy error', arguments);
});

server.listen(WEBPACK_DEV_PROXY);
