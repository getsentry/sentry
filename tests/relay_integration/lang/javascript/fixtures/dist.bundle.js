/******/ (function(modules) {
  // webpackBootstrap
  /******/ // The module cache
  /******/ var installedModules = {}; // The require function
  /******/
  /******/ /******/ function __webpack_require__(moduleId) {
    /******/
    /******/ // Check if module is in cache
    /******/ if (installedModules[moduleId]) {
      /******/ return installedModules[moduleId].exports;
      /******/
    } // Create a new module (and put it into the cache)
    /******/ /******/ var module = (installedModules[moduleId] = {
      /******/ i: moduleId,
      /******/ l: false,
      /******/ exports: {},
      /******/
    }); // Execute the module function
    /******/
    /******/ /******/ modules[moduleId].call(
      module.exports,
      module,
      module.exports,
      __webpack_require__
    ); // Flag the module as loaded
    /******/
    /******/ /******/ module.l = true; // Return the exports of the module
    /******/
    /******/ /******/ return module.exports;
    /******/
  } // expose the modules object (__webpack_modules__)
  /******/
  /******/
  /******/ /******/ __webpack_require__.m = modules; // expose the module cache
  /******/
  /******/ /******/ __webpack_require__.c = installedModules; // define getter function for harmony exports
  /******/
  /******/ /******/ __webpack_require__.d = function(exports, name, getter) {
    /******/ if (!__webpack_require__.o(exports, name)) {
      /******/ Object.defineProperty(exports, name, {
        /******/ configurable: false,
        /******/ enumerable: true,
        /******/ get: getter,
        /******/
      });
      /******/
    }
    /******/
  }; // getDefaultExport function for compatibility with non-harmony modules
  /******/
  /******/ /******/ __webpack_require__.n = function(module) {
    /******/ var getter =
      module && module.__esModule
        ? /******/ function getDefault() {
            return module['default'];
          }
        : /******/ function getModuleExports() {
            return module;
          };
    /******/ __webpack_require__.d(getter, 'a', getter);
    /******/ return getter;
    /******/
  }; // Object.prototype.hasOwnProperty.call
  /******/
  /******/ /******/ __webpack_require__.o = function(object, property) {
    return Object.prototype.hasOwnProperty.call(object, property);
  }; // __webpack_public_path__
  /******/
  /******/ /******/ __webpack_require__.p = ''; // Load entry module and return exports
  /******/
  /******/ /******/ return __webpack_require__((__webpack_require__.s = 15));
  /******/
})(
  /************************************************************************/
  /******/ [
    /* 0 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict';

      var fs = __webpack_require__(8);
      var url = __webpack_require__(7);
      var transports = __webpack_require__(3);
      var path = __webpack_require__(2);
      var lsmod = __webpack_require__(21);
      var stacktrace = __webpack_require__(22);

      var ravenVersion = __webpack_require__(11).version;

      var protocolMap = {
        http: 80,
        https: 443,
      };

      var consoleAlerts = {};

      module.exports.disableConsoleAlerts = function disableConsoleAlerts() {
        consoleAlerts = false;
      };

      module.exports.consoleAlert = function consoleAlert(msg) {
        if (consoleAlerts) {
          console.log('raven@' + ravenVersion + ' alert: ' + msg);
        }
      };

      module.exports.consoleAlertOnce = function consoleAlertOnce(msg) {
        if (consoleAlerts && !(msg in consoleAlerts)) {
          consoleAlerts[msg] = true;
          console.log('raven@' + ravenVersion + ' alert: ' + msg);
        }
      };

      module.exports.extend =
        Object.assign ||
        function(target) {
          for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            for (var key in source) {
              if (Object.prototype.hasOwnProperty.call(source, key)) {
                target[key] = source[key];
              }
            }
          }
          return target;
        };

      module.exports.getAuthHeader = function getAuthHeader(
        timestamp,
        apiKey,
        apiSecret
      ) {
        var header = ['Sentry sentry_version=5'];
        header.push('sentry_timestamp=' + timestamp);
        header.push('sentry_client=raven-node/' + ravenVersion);
        header.push('sentry_key=' + apiKey);
        if (apiSecret) header.push('sentry_secret=' + apiSecret);
        return header.join(', ');
      };

      module.exports.parseDSN = function parseDSN(dsn) {
        if (!dsn) {
          // Let a falsey value return false explicitly
          return false;
        }
        try {
          var parsed = url.parse(dsn),
            response = {
              protocol: parsed.protocol.slice(0, -1),
              public_key: parsed.auth.split(':')[0],
              host: parsed.host.split(':')[0],
            };

          if (parsed.auth.split(':')[1]) {
            response.private_key = parsed.auth.split(':')[1];
          }

          if (~response.protocol.indexOf('+')) {
            response.protocol = response.protocol.split('+')[1];
          }

          if (!transports.hasOwnProperty(response.protocol)) {
            throw new Error('Invalid transport');
          }

          var index = parsed.pathname.lastIndexOf('/');
          response.path = parsed.pathname.substr(0, index + 1);
          response.project_id = parsed.pathname.substr(index + 1);
          response.port = ~~parsed.port || protocolMap[response.protocol] || 443;
          return response;
        } catch (e) {
          throw new Error('Invalid Sentry DSN: ' + dsn);
        }
      };

      module.exports.getCulprit = function getCulprit(frame) {
        if (frame.module || frame.function) {
          return (frame.module || '?') + ' at ' + (frame.function || '?');
        }
        return '<unknown>';
      };

      var moduleCache;
      module.exports.getModules = function getModules() {
        if (!moduleCache) {
          moduleCache = lsmod();
        }
        return moduleCache;
      };

      module.exports.fill = function(obj, name, replacement, track) {
        var orig = obj[name];
        obj[name] = replacement(orig);
        if (track) {
          track.push([obj, name, orig]);
        }
      };

      var LINES_OF_CONTEXT = 7;

      function getFunction(line) {
        try {
          return (
            line.getFunctionName() ||
            line.getTypeName() + '.' + (line.getMethodName() || '<anonymous>')
          );
        } catch (e) {
          // This seems to happen sometimes when using 'use strict',
          // stemming from `getTypeName`.
          // [TypeError: Cannot read property 'constructor' of undefined]
          return '<anonymous>';
        }
      }

      var mainModule =
        ((__webpack_require__.c[__webpack_require__.s] &&
          __webpack_require__.c[__webpack_require__.s].filename &&
          path.dirname(__webpack_require__.c[__webpack_require__.s].filename)) ||
          process.cwd()) + '/';

      function getModule(filename, base) {
        if (!base) base = mainModule;

        // It's specifically a module
        var file = path.basename(filename, '.js');
        filename = path.dirname(filename);
        var n = filename.lastIndexOf('/node_modules/');
        if (n > -1) {
          // /node_modules/ is 14 chars
          return filename.substr(n + 14).replace(/\//g, '.') + ':' + file;
        }
        // Let's see if it's a part of the main module
        // To be a part of main module, it has to share the same base
        n = (filename + '/').lastIndexOf(base, 0);
        if (n === 0) {
          var module = filename.substr(base.length).replace(/\//g, '.');
          if (module) module += ':';
          module += file;
          return module;
        }
        return file;
      }

      function readSourceFiles(filenames, cb) {
        // we're relying on filenames being de-duped already
        if (filenames.length === 0) return setTimeout(cb, 0, {});

        var sourceFiles = {};
        var numFilesToRead = filenames.length;
        return filenames.forEach(function(filename) {
          fs.readFile(filename, function(readErr, file) {
            if (!readErr) sourceFiles[filename] = file.toString().split('\n');
            if (--numFilesToRead === 0) cb(sourceFiles);
          });
        });
      }

      // This is basically just `trim_line` from https://github.com/getsentry/sentry/blob/master/src/sentry/lang/javascript/processor.py#L67
      function snipLine(line, colno) {
        var ll = line.length;
        if (ll <= 150) return line;
        if (colno > ll) colno = ll;

        var start = Math.max(colno - 60, 0);
        if (start < 5) start = 0;

        var end = Math.min(start + 140, ll);
        if (end > ll - 5) end = ll;
        if (end === ll) start = Math.max(end - 140, 0);

        line = line.slice(start, end);
        if (start > 0) line = '{snip} ' + line;
        if (end < ll) line += ' {snip}';

        return line;
      }

      function snipLine0(line) {
        return snipLine(line, 0);
      }

      function parseStack(err, cb) {
        if (!err) return cb([]);

        var stack = stacktrace.parse(err);
        if (!stack || !Array.isArray(stack) || !stack.length || !stack[0].getFileName) {
          // the stack is not the useful thing we were expecting :/
          return cb([]);
        }

        // Sentry expects the stack trace to be oldest -> newest, v8 provides newest -> oldest
        stack.reverse();

        var frames = [];
        var filesToRead = {};
        stack.forEach(function(line) {
          var frame = {
            filename: line.getFileName() || '',
            lineno: line.getLineNumber(),
            colno: line.getColumnNumber(),
            function: getFunction(line),
          };

          var isInternal =
            line.isNative() ||
            (frame.filename[0] !== '/' &&
              frame.filename[0] !== '.' &&
              frame.filename.indexOf(':\\') !== 1);

          // in_app is all that's not an internal Node function or a module within node_modules
          // note that isNative appears to return true even for node core libraries
          // see https://github.com/getsentry/raven-node/issues/176
          frame.in_app = !isInternal && frame.filename.indexOf('node_modules/') === -1;

          // Extract a module name based on the filename
          if (frame.filename) {
            frame.module = getModule(frame.filename);
            if (!isInternal) filesToRead[frame.filename] = true;
          }

          frames.push(frame);
        });

        return readSourceFiles(Object.keys(filesToRead), function(sourceFiles) {
          frames.forEach(function(frame) {
            if (frame.filename && sourceFiles[frame.filename]) {
              var lines = sourceFiles[frame.filename];
              try {
                frame.pre_context = lines
                  .slice(
                    Math.max(0, frame.lineno - (LINES_OF_CONTEXT + 1)),
                    frame.lineno - 1
                  )
                  .map(snipLine0);
                frame.context_line = snipLine(lines[frame.lineno - 1], frame.colno);
                frame.post_context = lines
                  .slice(frame.lineno, frame.lineno + LINES_OF_CONTEXT)
                  .map(snipLine0);
              } catch (e) {
                // anomaly, being defensive in case
                // unlikely to ever happen in practice but can definitely happen in theory
              }
            }
          });

          cb(frames);
        });
      }

      // expose basically for testing because I don't know what I'm doing
      module.exports.parseStack = parseStack;
      module.exports.getModule = getModule;

      /***/
    },
    /* 1 */
    /***/ function(module, exports) {
      module.exports = require('util');

      /***/
    },
    /* 2 */
    /***/ function(module, exports) {
      module.exports = require('path');

      /***/
    },
    /* 3 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict';

      var events = __webpack_require__(9);
      var util = __webpack_require__(1);
      var timeoutReq = __webpack_require__(19);

      var http = __webpack_require__(10);
      var https = __webpack_require__(20);

      var agentOptions = {keepAlive: true, maxSockets: 100};
      var httpAgent = new http.Agent(agentOptions);
      var httpsAgent = new https.Agent(agentOptions);

      function Transport() {}
      util.inherits(Transport, events.EventEmitter);

      function HTTPTransport(options) {
        this.defaultPort = 80;
        this.transport = http;
        this.options = options || {};
        this.agent = httpAgent;
      }
      util.inherits(HTTPTransport, Transport);
      HTTPTransport.prototype.send = function(client, message, headers, eventId, cb) {
        var options = {
          hostname: client.dsn.host,
          path: client.dsn.path + 'api/' + client.dsn.project_id + '/store/',
          headers: headers,
          method: 'POST',
          port: client.dsn.port || this.defaultPort,
          ca: client.ca,
          agent: this.agent,
        };
        for (var key in this.options) {
          if (this.options.hasOwnProperty(key)) {
            options[key] = this.options[key];
          }
        }

        // prevent off heap memory explosion
        var _name = this.agent.getName({host: client.dsn.host, port: client.dsn.port});
        var _requests = this.agent.requests[_name];
        if (_requests && Object.keys(_requests).length > client.maxReqQueueCount) {
          // other feedback strategy
          client.emit('error', new Error('client req queue is full..'));
          return;
        }

        var req = this.transport.request(options, function(res) {
          res.setEncoding('utf8');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            client.emit('logged', eventId);
            cb && cb(null, eventId);
          } else {
            var reason = res.headers['x-sentry-error'];
            var e = new Error('HTTP Error (' + res.statusCode + '): ' + reason);
            e.response = res;
            e.statusCode = res.statusCode;
            e.reason = reason;
            e.sendMessage = message;
            e.requestHeaders = headers;
            e.eventId = eventId;
            client.emit('error', e);
            cb && cb(e);
          }

          // force the socket to drain
          var noop = function() {};
          res.on('data', noop);
          res.on('end', noop);
        });

        timeoutReq(req, client.sendTimeout * 1000);

        var cbFired = false;
        req.on('error', function(e) {
          client.emit('error', e);
          if (!cbFired) {
            cb && cb(e);
            cbFired = true;
          }
        });
        req.end(message);
      };

      function HTTPSTransport(options) {
        this.defaultPort = 443;
        this.transport = https;
        this.options = options || {};
        this.agent = httpsAgent;
      }
      util.inherits(HTTPSTransport, HTTPTransport);

      module.exports.http = new HTTPTransport();
      module.exports.https = new HTTPSTransport();
      module.exports.Transport = Transport;
      module.exports.HTTPTransport = HTTPTransport;
      module.exports.HTTPSTransport = HTTPSTransport;

      /***/
    },
    /* 4 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict';

      var utils = __webpack_require__(0);

      var defaultOnConfig = {
        console: true,
      };

      var defaultConfig = {
        console: false,
        http: false,
        pg: false,
      };

      function instrument(Raven, config) {
        if (config === false) {
          return;
        } else if (config === true) {
          config = defaultOnConfig;
        } else {
          config = utils.extend({}, defaultConfig, config);
        }

        Raven.instrumentedOriginals = [];
        Raven.instrumentedModules = [];

        var Module = __webpack_require__(28);
        utils.fill(
          Module,
          '_load',
          function(origLoad) {
            return function(moduleId, parent, isMain) {
              var origModule = origLoad.apply(this, arguments);
              if (
                config[moduleId] &&
                Raven.instrumentedModules.indexOf(moduleId) === -1
              ) {
                Raven.instrumentedModules.push(moduleId);
                return __webpack_require__(29)('./' + moduleId)(
                  Raven,
                  origModule,
                  Raven.instrumentedOriginals
                );
              }
              return origModule;
            };
          },
          Raven.instrumentedOriginals
        );

        // special case: since console is built-in and app-level code won't require() it, do that here
        if (config.console) {
          __webpack_require__(30);
        }

        // observation: when the https module does its own require('http'), it *does not* hit our hooked require to instrument http on the fly
        // but if we've previously instrumented http, https *does* get our already-instrumented version
        // this is because raven's transports are required before this instrumentation takes place, which loads https (and http)
        // so module cache will have uninstrumented http; proactively loading it here ensures instrumented version is in module cache
        // alternatively we could refactor to load our transports later, but this is easier and doesn't have much drawback
        if (config.http) {
          __webpack_require__(10);
        }
      }

      function deinstrument(Raven) {
        if (!Raven.instrumentedOriginals) return;
        var original;
        // eslint-disable-next-line no-cond-assign
        while ((original = Raven.instrumentedOriginals.shift())) {
          var obj = original[0];
          var name = original[1];
          var orig = original[2];
          obj[name] = orig;
        }
      }

      module.exports = {
        instrument: instrument,
        deinstrument: deinstrument,
      };

      /***/
    },
    /* 5 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict';

      /*
 json-stringify-safe
 Like JSON.stringify, but doesn't throw on circular references.

 Originally forked from https://github.com/isaacs/json-stringify-safe
 version 5.0.1 on 2017-09-21 and modified to handle Errors serialization.
 Tests for this are in test/vendor.

 ISC license: https://github.com/isaacs/json-stringify-safe/blob/master/LICENSE
 */

      exports = module.exports = stringify;
      exports.getSerialize = serializer;

      function stringify(obj, replacer, spaces, cycleReplacer) {
        return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces);
      }

      // https://github.com/ftlabs/js-abbreviate/blob/fa709e5f139e7770a71827b1893f22418097fbda/index.js#L95-L106
      function stringifyError(value) {
        var err = {
          // These properties are implemented as magical getters and don't show up in for in
          stack: value.stack,
          message: value.message,
          name: value.name,
        };

        for (var i in value) {
          if (Object.prototype.hasOwnProperty.call(value, i)) {
            err[i] = value[i];
          }
        }

        return err;
      }

      function serializer(replacer, cycleReplacer) {
        var stack = [];
        var keys = [];

        if (cycleReplacer == null) {
          cycleReplacer = function(key, value) {
            if (stack[0] === value) {
              return '[Circular ~]';
            }
            return '[Circular ~.' + keys.slice(0, stack.indexOf(value)).join('.') + ']';
          };
        }

        return function(key, value) {
          if (stack.length > 0) {
            var thisPos = stack.indexOf(this);
            ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
            ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);

            if (~stack.indexOf(value)) {
              value = cycleReplacer.call(this, key, value);
            }
          } else {
            stack.push(value);
          }

          return replacer == null
            ? value instanceof Error ? stringifyError(value) : value
            : replacer.call(this, key, value);
        };
      }

      /***/
    },
    /* 6 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict';

      var cookie = __webpack_require__(18);
      var urlParser = __webpack_require__(7);
      var stringify = __webpack_require__(5);

      var utils = __webpack_require__(0);

      module.exports.parseText = function parseText(message, kwargs) {
        kwargs = kwargs || {};
        kwargs.message = message;

        return kwargs;
      };

      module.exports.parseError = function parseError(err, kwargs, cb) {
        utils.parseStack(err, function(frames) {
          var name =
            ({}.hasOwnProperty.call(err, 'name') ? err.name : err.constructor.name) + '';
          if (typeof kwargs.message === 'undefined') {
            kwargs.message = name + ': ' + (err.message || '<no message>');
          }
          kwargs.exception = [
            {
              type: name,
              value: err.message,
              stacktrace: {
                frames: frames,
              },
            },
          ];

          // Save additional error properties to `extra` under the error type (e.g. `extra.AttributeError`)
          var extraErrorProps;
          for (var key in err) {
            if (err.hasOwnProperty(key)) {
              if (
                key !== 'name' &&
                key !== 'message' &&
                key !== 'stack' &&
                key !== 'domain'
              ) {
                extraErrorProps = extraErrorProps || {};
                extraErrorProps[key] = err[key];
              }
            }
          }
          if (extraErrorProps) {
            kwargs.extra = kwargs.extra || {};
            kwargs.extra[name] = extraErrorProps;
          }

          for (var n = frames.length - 1; n >= 0; n--) {
            if (frames[n].in_app) {
              kwargs.culprit = kwargs.culprit || utils.getCulprit(frames[n]);
              break;
            }
          }

          cb(kwargs);
        });
      };

      module.exports.parseRequest = function parseRequest(req, parseUser) {
        var kwargs = {};

        // headers:
        //   node, express: req.headers
        //   koa: req.header
        var headers = req.headers || req.header || {};

        // method:
        //   node, express, koa: req.method
        var method = req.method;

        // host:
        //   express: req.hostname in > 4 and req.host in < 4
        //   koa: req.host
        //   node: req.headers.host
        var host = req.hostname || req.host || headers.host || '<no host>';

        // protocol:
        //   node: <n/a>
        //   express, koa: req.protocol
        var protocol =
          req.protocol === 'https' || req.secure || (req.socket || {}).encrypted
            ? 'https'
            : 'http';

        // url (including path and query string):
        //   node, express: req.originalUrl
        //   koa: req.url
        var originalUrl = req.originalUrl || req.url;

        // absolute url
        var absoluteUrl = protocol + '://' + host + originalUrl;

        // query string:
        //   node: req.url (raw)
        //   express, koa: req.query
        var query = req.query || urlParser.parse(originalUrl || '', true).query;

        // cookies:
        //   node, express, koa: req.headers.cookie
        var cookies = cookie.parse(headers.cookie || '');

        // body data:
        //   node, express, koa: req.body
        var data = req.body;
        if (['GET', 'HEAD'].indexOf(method) === -1) {
          if (typeof data === 'undefined') {
            data = '<unavailable>';
          }
        }

        if (
          data &&
          typeof data !== 'string' &&
          {}.toString.call(data) !== '[object String]'
        ) {
          // Make sure the request body is a string
          data = stringify(data);
        }

        // http interface
        var http = {
          method: method,
          query_string: query,
          headers: headers,
          cookies: cookies,
          data: data,
          url: absoluteUrl,
        };

        // expose http interface
        kwargs.request = http;

        // user: typically found on req.user in express/passport patterns
        // five cases for parseUser value:
        //   absent: grab only id, username, email from req.user
        //   false: capture nothing
        //   true: capture all keys from req.user
        //   array: provided whitelisted keys to grab from req.user
        //   function :: req -> user: custom parsing function
        if (parseUser == null) parseUser = ['id', 'username', 'email'];
        if (parseUser) {
          var user = {};
          if (typeof parseUser === 'function') {
            user = parseUser(req);
          } else if (req.user) {
            if (parseUser === true) {
              for (var key in req.user) {
                if ({}.hasOwnProperty.call(req.user, key)) {
                  user[key] = req.user[key];
                }
              }
            } else {
              parseUser.forEach(function(fieldName) {
                if ({}.hasOwnProperty.call(req.user, fieldName)) {
                  user[fieldName] = req.user[fieldName];
                }
              });
            }
          }

          // client ip:
          //   node: req.connection.remoteAddress
          //   express, koa: req.ip
          var ip = req.ip || (req.connection && req.connection.remoteAddress);
          if (ip) {
            user.ip_address = ip;
          }

          kwargs.user = user;
        }

        return kwargs;
      };

      /***/
    },
    /* 7 */
    /***/ function(module, exports) {
      module.exports = require('url');

      /***/
    },
    /* 8 */
    /***/ function(module, exports) {
      module.exports = require('fs');

      /***/
    },
    /* 9 */
    /***/ function(module, exports) {
      module.exports = require('events');

      /***/
    },
    /* 10 */
    /***/ function(module, exports) {
      module.exports = require('http');

      /***/
    },
    /* 11 */
    /***/ function(module, exports) {
      module.exports = {
        _from: 'raven@^2.2.1',
        _id: 'raven@2.2.1',
        _inBundle: false,
        _integrity: 'sha1-V8f75oqAFH7FJ97z18AVdc+Uj+M=',
        _location: '/raven',
        _phantomChildren: {},
        _requested: {
          type: 'range',
          registry: true,
          raw: 'raven@^2.2.1',
          name: 'raven',
          escapedName: 'raven',
          rawSpec: '^2.2.1',
          saveSpec: null,
          fetchSpec: '^2.2.1',
        },
        _requiredBy: ['#USER', '/'],
        _resolved: 'https://registry.npmjs.org/raven/-/raven-2.2.1.tgz',
        _shasum: '57c7fbe68a80147ec527def3d7c01575cf948fe3',
        _spec: 'raven@^2.2.1',
        _where: '/Users/kamilogorek/Projects/sentry/repros/node-sourcemaps',
        author: {name: 'Matt Robenolt', email: 'matt@ydekproductions.com'},
        bin: {raven: './bin/raven'},
        bugs: {url: 'https://github.com/getsentry/raven-node/issues'},
        bundleDependencies: false,
        dependencies: {
          cookie: '0.3.1',
          lsmod: '1.0.0',
          'stack-trace': '0.0.9',
          'timed-out': '4.0.1',
          uuid: '3.0.0',
        },
        deprecated: false,
        description: 'A standalone (Node.js) client for Sentry',
        devDependencies: {
          'coffee-script': '~1.10.0',
          connect: '*',
          eslint: '^4.5.0',
          'eslint-config-prettier': '^2.3.0',
          express: '*',
          glob: '~3.1.13',
          husky: '^0.14.3',
          istanbul: '^0.4.3',
          'lint-staged': '^4.0.4',
          mocha: '~3.1.2',
          nock: '~9.0.0',
          prettier: '^1.6.1',
          should: '11.2.0',
          sinon: '^3.3.0',
        },
        engines: {node: '>= 4.0.0'},
        homepage: 'https://github.com/getsentry/raven-node',
        keywords: ['debugging', 'errors', 'exceptions', 'logging', 'raven', 'sentry'],
        license: 'BSD-2-Clause',
        'lint-staged': {'*.js': ['prettier --write', 'git add']},
        main: 'index.js',
        name: 'raven',
        prettier: {singleQuote: true, bracketSpacing: false, printWidth: 90},
        repository: {type: 'git', url: 'git://github.com/getsentry/raven-node.git'},
        scripts: {
          lint: 'node_modules/eslint/bin/eslint.js .',
          precommit: 'lint-staged',
          pretest: 'npm install && npm run lint',
          test:
            'NODE_ENV=test istanbul cover _mocha  -- --reporter dot && NODE_ENV=test node_modules/coffee-script/bin/coffee ./test/run.coffee',
          'test-full': 'npm run test && cd test/instrumentation && ./run.sh',
          'test-mocha': 'NODE_ENV=test mocha',
        },
        version: '2.2.1',
      };

      /***/
    },
    /* 12 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict';

      var util = __webpack_require__(1);
      var utils = __webpack_require__(0);

      module.exports = function(Raven, console, originals) {
        var wrapConsoleMethod = function(level) {
          if (!(level in console)) {
            return;
          }

          utils.fill(
            console,
            level,
            function(originalConsoleLevel) {
              var sentryLevel = level === 'warn' ? 'warning' : level;

              return function() {
                var args = [].slice.call(arguments);

                Raven.captureBreadcrumb({
                  message: util.format.apply(null, args),
                  level: sentryLevel,
                  category: 'console',
                });

                originalConsoleLevel.apply(console, args);
              };
            },
            originals
          );
        };

        ['debug', 'info', 'warn', 'error', 'log'].forEach(wrapConsoleMethod);

        return console;
      };

      /***/
    },
    /* 13 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict';

      var util = __webpack_require__(1);
      var utils = __webpack_require__(0);

      module.exports = function(Raven, http, originals) {
        var OrigClientRequest = http.ClientRequest;
        var ClientRequest = function(options, cb) {
          // Note: this won't capture a breadcrumb if a response never comes
          // It would be useful to know if that was the case, though, so
          // todo: revisit to see if we can capture sth indicating response never came
          // possibility: capture one breadcrumb for "req sent" and one for "res recvd"
          // seems excessive but solves the problem and *is* strictly more information
          // could be useful for weird response sequencing bug scenarios
          OrigClientRequest.call(this, options, cb);

          // We could just always reconstruct this from this.agent, this._headers, this.path, etc
          // but certain other http-instrumenting libraries (like nock, which we use for tests) fail to
          // maintain the guarantee that after calling OrigClientRequest, those fields will be populated
          if (typeof options === 'string') {
            this.__ravenBreadcrumbUrl = options;
          } else {
            this.__ravenBreadcrumbUrl =
              (options.protocol || '') +
              '//' +
              (options.hostname || options.host || '') +
              (options.path || '/');
          }
        };
        util.inherits(ClientRequest, OrigClientRequest);

        utils.fill(ClientRequest.prototype, 'emit', function(origEmit) {
          return function(evt, maybeResp) {
            if (evt === 'response' && this.__ravenBreadcrumbUrl) {
              if (
                !Raven.dsn ||
                this.__ravenBreadcrumbUrl.indexOf(Raven.dsn.host) === -1
              ) {
                Raven.captureBreadcrumb({
                  type: 'http',
                  category: 'http',
                  data: {
                    method: this.method,
                    url: this.__ravenBreadcrumbUrl,
                    status_code: maybeResp.statusCode,
                  },
                });
              }
            }
            return origEmit.apply(this, arguments);
          };
        });

        utils.fill(
          http,
          'ClientRequest',
          function() {
            return ClientRequest;
          },
          originals
        );

        // http.request orig refs module-internal ClientRequest, not exported one, so
        // it still points at orig ClientRequest after our monkeypatch; these reimpls
        // just get that reference updated to use our new ClientRequest
        utils.fill(
          http,
          'request',
          function() {
            return function(options, cb) {
              return new http.ClientRequest(options, cb);
            };
          },
          originals
        );

        utils.fill(
          http,
          'get',
          function() {
            return function(options, cb) {
              var req = http.request(options, cb);
              req.end();
              return req;
            };
          },
          originals
        );

        return http;
      };

      /***/
    },
    /* 14 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict';

      module.exports = function(Raven, pg, originals) {
        // Using fill helper here is hard because of `this` binding
        var origQuery = pg.Connection.prototype.query;
        pg.Connection.prototype.query = function(text) {
          Raven.captureBreadcrumb({
            category: 'postgres',
            message: text,
          });
          origQuery.call(this, text);
        };
        // todo thread this through
        // originals.push([pg.Connection.prototype, 'query', origQuery]);
      };

      /***/
    },
    /* 15 */
    /***/ function(module, exports, __webpack_require__) {
      var Raven = __webpack_require__(16);
      var path = __webpack_require__(2);
      var foo = __webpack_require__(32);

      Raven.config(
        'http://36dfaa7c54664f429aac79ac89d7fb68:b4505a72a8ce4ecd8deb8038124b0909@localhost:8000/8',
        {
          release: process.env.RELEASE,
          dataCallback: function(data) {
            var stacktrace = data.exception && data.exception[0].stacktrace;

            if (stacktrace && stacktrace.frames) {
              stacktrace.frames.forEach(function(frame) {
                if (frame.filename.startsWith('/')) {
                  frame.filename = 'app:///' + path.basename(frame.filename);
                }
              });
            }

            console.log(JSON.stringify(data, null, 2));

            return data;
          },
          shouldSendCallback: function() {
            return 'false';
          },
        }
      ).install();

      function App() {
        foo();
      }

      App();

      setTimeout(function() {
        App();
      }, 500);

      /***/
    },
    /* 16 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict';

      module.exports = __webpack_require__(17);
      module.exports.utils = __webpack_require__(0);

      module.exports.transports = __webpack_require__(3);
      module.exports.parsers = __webpack_require__(6);

      // To infinity and beyond
      Error.stackTraceLimit = Infinity;

      /***/
    },
    /* 17 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict';

      var stringify = __webpack_require__(5);
      var parsers = __webpack_require__(6);
      var zlib = __webpack_require__(23);
      var utils = __webpack_require__(0);
      var uuid = __webpack_require__(24);
      var transports = __webpack_require__(3);
      var nodeUtil = __webpack_require__(1); // nodeUtil to avoid confusion with "utils"
      var events = __webpack_require__(9);
      var domain = __webpack_require__(27);

      var instrumentor = __webpack_require__(4);

      var extend = utils.extend;

      function Raven() {
        this.breadcrumbs = {
          record: this.captureBreadcrumb.bind(this),
        };
      }

      nodeUtil.inherits(Raven, events.EventEmitter);

      extend(Raven.prototype, {
        config: function config(dsn, options) {
          // We get lots of users using raven-node when they want raven-js, hence this warning if it seems like a browser
          if (
            typeof window !== 'undefined' &&
            typeof document !== 'undefined' &&
            typeof navigator !== 'undefined'
          ) {
            utils.consoleAlertOnce(
              "This looks like a browser environment; are you sure you don't want Raven.js for browser JavaScript? https://sentry.io/for/javascript"
            );
          }

          if (arguments.length === 0) {
            // no arguments, use default from environment
            dsn = process.env.SENTRY_DSN;
            options = {};
          }
          if (typeof dsn === 'object') {
            // They must only be passing through options
            options = dsn;
            dsn = process.env.SENTRY_DSN;
          }
          options = options || {};

          this.raw_dsn = dsn;
          this.dsn = utils.parseDSN(dsn);
          this.name =
            options.name || process.env.SENTRY_NAME || __webpack_require__(31).hostname();
          this.root = options.root || process.cwd();
          this.transport = options.transport || transports[this.dsn.protocol];
          this.sendTimeout = options.sendTimeout || 1;
          this.release = options.release || process.env.SENTRY_RELEASE || '';
          this.environment =
            options.environment ||
            process.env.SENTRY_ENVIRONMENT ||
            process.env.NODE_ENV ||
            '';

          // autoBreadcrumbs: true enables all, autoBreadcrumbs: false disables all
          // autoBreadcrumbs: { http: true } enables a single type
          this.autoBreadcrumbs = options.autoBreadcrumbs || false;
          // default to 30, don't allow higher than 100
          this.maxBreadcrumbs = Math.max(0, Math.min(options.maxBreadcrumbs || 30, 100));

          this.captureUnhandledRejections = options.captureUnhandledRejections;
          this.loggerName = options.logger || '';
          this.dataCallback = options.dataCallback;
          this.shouldSendCallback = options.shouldSendCallback;
          this.sampleRate =
            typeof options.sampleRate === 'undefined' ? 1 : options.sampleRate;
          this.maxReqQueueCount = options.maxReqQueueCount || 100;
          this.parseUser = options.parseUser;

          if (!this.dsn) {
            utils.consoleAlert('no DSN provided, error reporting disabled');
          }

          if (this.dsn.protocol === 'https') {
            // In case we want to provide our own SSL certificates / keys
            this.ca = options.ca || null;
          }

          // enabled if a dsn is set
          this._enabled = !!this.dsn;

          var globalContext = (this._globalContext = {});
          if (options.tags) {
            globalContext.tags = options.tags;
          }
          if (options.extra) {
            globalContext.extra = options.extra;
          }

          this.onFatalError = this.defaultOnFatalError = function(err, sendErr, eventId) {
            console.error(err && err.stack ? err.stack : err);
            process.exit(1);
          };
          this.uncaughtErrorHandler = this.makeErrorHandler();

          this.on('error', function(err) {
            utils.consoleAlert('failed to send exception to sentry: ' + err.message);
          });

          return this;
        },

        install: function install(cb) {
          if (this.installed) return this;

          if (typeof cb === 'function') {
            this.onFatalError = cb;
          }

          process.on('uncaughtException', this.uncaughtErrorHandler);

          if (this.captureUnhandledRejections) {
            var self = this;
            process.on('unhandledRejection', function(reason) {
              self.captureException(reason, function(sendErr, eventId) {
                if (!sendErr)
                  utils.consoleAlert('unhandledRejection captured: ' + eventId);
              });
            });
          }

          instrumentor.instrument(this, this.autoBreadcrumbs);

          this.installed = true;

          return this;
        },

        uninstall: function uninstall() {
          if (!this.installed) return this;

          instrumentor.deinstrument(this);

          // todo: this works for tests for now, but isn't what we ultimately want to be doing
          process.removeAllListeners('uncaughtException');
          process.removeAllListeners('unhandledRejection');

          this.installed = false;

          return this;
        },

        makeErrorHandler: function() {
          var self = this;
          var caughtFirstError = false;
          var caughtSecondError = false;
          var calledFatalError = false;
          var firstError;
          return function(err) {
            if (!caughtFirstError) {
              // this is the first uncaught error and the ultimate reason for shutting down
              // we want to do absolutely everything possible to ensure it gets captured
              // also we want to make sure we don't go recursion crazy if more errors happen after this one
              firstError = err;
              caughtFirstError = true;
              self.captureException(err, function(sendErr, eventId) {
                if (!calledFatalError) {
                  calledFatalError = true;
                  self.onFatalError(err, sendErr, eventId);
                }
              });
            } else if (calledFatalError) {
              // we hit an error *after* calling onFatalError - pretty boned at this point, just shut it down
              utils.consoleAlert(
                'uncaught exception after calling fatal error shutdown callback - this is bad! forcing shutdown'
              );
              self.defaultOnFatalError(err);
            } else if (!caughtSecondError) {
              // two cases for how we can hit this branch:
              //   - capturing of first error blew up and we just caught the exception from that
              //     - quit trying to capture, proceed with shutdown
              //   - a second independent error happened while waiting for first error to capture
              //     - want to avoid causing premature shutdown before first error capture finishes
              // it's hard to immediately tell case 1 from case 2 without doing some fancy/questionable domain stuff
              // so let's instead just delay a bit before we proceed with our action here
              // in case 1, we just wait a bit unnecessarily but ultimately do the same thing
              // in case 2, the delay hopefully made us wait long enough for the capture to finish
              // two potential nonideal outcomes:
              //   nonideal case 1: capturing fails fast, we sit around for a few seconds unnecessarily before proceeding correctly by calling onFatalError
              //   nonideal case 2: case 2 happens, 1st error is captured but slowly, timeout completes before capture and we treat second error as the sendErr of (nonexistent) failure from trying to capture first error
              // note that after hitting this branch, we might catch more errors where (caughtSecondError && !calledFatalError)
              //   we ignore them - they don't matter to us, we're just waiting for the second error timeout to finish
              caughtSecondError = true;
              setTimeout(function() {
                if (!calledFatalError) {
                  // it was probably case 1, let's treat err as the sendErr and call onFatalError
                  calledFatalError = true;
                  self.onFatalError(firstError, err);
                } else {
                  // it was probably case 2, our first error finished capturing while we waited, cool, do nothing
                }
              }, (self.sendTimeout + 1) * 1000); // capturing could take at least sendTimeout to fail, plus an arbitrary second for how long it takes to collect surrounding source etc
            }
          };
        },

        generateEventId: function generateEventId() {
          return uuid().replace(/-/g, '');
        },

        process: function process(eventId, kwargs, cb) {
          // prod codepaths shouldn't hit this branch, for testing
          if (typeof eventId === 'object') {
            cb = kwargs;
            kwargs = eventId;
            eventId = this.generateEventId();
          }

          var domainContext = (domain.active && domain.active.sentryContext) || {};
          kwargs.user = extend(
            {},
            this._globalContext.user,
            domainContext.user,
            kwargs.user
          );
          kwargs.tags = extend(
            {},
            this._globalContext.tags,
            domainContext.tags,
            kwargs.tags
          );
          kwargs.extra = extend(
            {},
            this._globalContext.extra,
            domainContext.extra,
            kwargs.extra
          );
          kwargs.breadcrumbs = {
            values: domainContext.breadcrumbs || this._globalContext.breadcrumbs || [],
          };

          /*
      `request` is our specified property name for the http interface: https://docs.sentry.io/clientdev/interfaces/http/
      `req` is the conventional name for a request object in node/express/etc
      we want to enable someone to pass a `request` property to kwargs according to http interface
      but also want to provide convenience for passing a req object and having us parse it out
      so we only parse a `req` property if the `request` property is absent/empty (and hence we won't clobber)
      parseUser returns a partial kwargs object with a `request` property and possibly a `user` property
    */
          kwargs.request = this._createRequestObject(
            this._globalContext.request,
            domainContext.request,
            kwargs.request
          );
          if (Object.keys(kwargs.request).length === 0) {
            var req = this._createRequestObject(
              this._globalContext.req,
              domainContext.req,
              kwargs.req
            );
            if (Object.keys(req).length > 0) {
              var parseUser =
                Object.keys(kwargs.user).length === 0 ? this.parseUser : false;
              extend(kwargs, parsers.parseRequest(req, parseUser));
              delete kwargs.req;
            }
          }

          kwargs.modules = utils.getModules();
          kwargs.server_name = kwargs.server_name || this.name;

          if (typeof process.version !== 'undefined') {
            kwargs.extra.node = process.version;
          }

          kwargs.environment = kwargs.environment || this.environment;
          kwargs.logger = kwargs.logger || this.loggerName;
          kwargs.event_id = eventId;
          kwargs.timestamp = new Date().toISOString().split('.')[0];
          kwargs.project = this.dsn.project_id;
          kwargs.platform = 'node';

          // Only include release information if it is set
          if (this.release) {
            kwargs.release = this.release;
          }

          if (this.dataCallback) {
            kwargs = this.dataCallback(kwargs);
          }

          var shouldSend = true;
          if (!this._enabled) shouldSend = false;
          if (this.shouldSendCallback && !this.shouldSendCallback(kwargs))
            shouldSend = false;
          if (Math.random() >= this.sampleRate) shouldSend = false;

          if (shouldSend) {
            this.send(kwargs, cb);
          } else {
            // wish there was a good way to communicate to cb why we didn't send; worth considering cb api change?
            // could be shouldSendCallback, could be disabled, could be sample rate
            // avoiding setImmediate here because node 0.8
            cb &&
              setTimeout(function() {
                cb(null, eventId);
              }, 0);
          }
        },

        send: function send(kwargs, cb) {
          var self = this;
          var skwargs = stringify(kwargs);
          var eventId = kwargs.event_id;

          zlib.deflate(skwargs, function(err, buff) {
            var message = buff.toString('base64'),
              timestamp = new Date().getTime(),
              headers = {
                'X-Sentry-Auth': utils.getAuthHeader(
                  timestamp,
                  self.dsn.public_key,
                  self.dsn.private_key
                ),
                'Content-Type': 'application/octet-stream',
                'Content-Length': message.length,
              };

            self.transport.send(self, message, headers, eventId, cb);
          });
        },

        captureMessage: function captureMessage(message, kwargs, cb) {
          if (!cb && typeof kwargs === 'function') {
            cb = kwargs;
            kwargs = {};
          } else {
            kwargs = kwargs || {};
          }
          var eventId = this.generateEventId();
          this.process(eventId, parsers.parseText(message, kwargs), cb);

          return eventId;
        },

        captureException: function captureException(err, kwargs, cb) {
          if (!(err instanceof Error)) {
            // This handles when someone does:
            //   throw "something awesome";
            // We synthesize an Error here so we can extract a (rough) stack trace.
            err = new Error(err);
          }

          if (!cb && typeof kwargs === 'function') {
            cb = kwargs;
            kwargs = {};
          } else {
            kwargs = kwargs || {};
          }

          var self = this;
          var eventId = this.generateEventId();
          parsers.parseError(err, kwargs, function(kw) {
            self.process(eventId, kw, cb);
          });

          return eventId;
        },

        context: function(ctx, func) {
          if (!func && typeof ctx === 'function') {
            func = ctx;
            ctx = {};
          }

          // todo/note: raven-js takes an args param to do apply(this, args)
          // i don't think it's correct/necessary to bind this to the wrap call
          // and i don't know if we need to support the args param; it's undocumented
          return this.wrap(ctx, func).apply(null);
        },

        wrap: function(options, func) {
          if (!func && typeof options === 'function') {
            func = options;
            options = {};
          }

          var wrapDomain = domain.create();
          // todo: better property name than sentryContext, maybe __raven__ or sth?
          wrapDomain.sentryContext = options;

          wrapDomain.on('error', this.uncaughtErrorHandler);
          var wrapped = wrapDomain.bind(func);

          for (var property in func) {
            if ({}.hasOwnProperty.call(func, property)) {
              wrapped[property] = func[property];
            }
          }
          wrapped.prototype = func.prototype;
          wrapped.__raven__ = true;
          wrapped.__inner__ = func;
          // note: domain.bind sets wrapped.domain, but it's not documented, unsure if we should rely on that
          wrapped.__domain__ = wrapDomain;

          return wrapped;
        },

        interceptErr: function(options, func) {
          if (!func && typeof options === 'function') {
            func = options;
            options = {};
          }
          var self = this;
          var wrapped = function() {
            var err = arguments[0];
            if (err instanceof Error) {
              self.captureException(err, options);
            } else {
              func.apply(null, arguments);
            }
          };

          // repetitive with wrap
          for (var property in func) {
            if ({}.hasOwnProperty.call(func, property)) {
              wrapped[property] = func[property];
            }
          }
          wrapped.prototype = func.prototype;
          wrapped.__raven__ = true;
          wrapped.__inner__ = func;

          return wrapped;
        },

        setContext: function setContext(ctx) {
          if (domain.active) {
            domain.active.sentryContext = ctx;
          } else {
            this._globalContext = ctx;
          }
          return this;
        },

        mergeContext: function mergeContext(ctx) {
          extend(this.getContext(), ctx);
          return this;
        },

        getContext: function getContext() {
          if (domain.active) {
            if (!domain.active.sentryContext) {
              domain.active.sentryContext = {};
              utils.consoleAlert('sentry context not found on active domain');
            }
            return domain.active.sentryContext;
          }
          return this._globalContext;
        },

        setCallbackHelper: function(propertyName, callback) {
          var original = this[propertyName];
          if (typeof callback === 'function') {
            this[propertyName] = function(data) {
              return callback(data, original);
            };
          } else {
            this[propertyName] = callback;
          }

          return this;
        },

        /*
   * Set the dataCallback option
   *
   * @param {function} callback The callback to run which allows the
   *                            data blob to be mutated before sending
   * @return {Raven}
   */
        setDataCallback: function(callback) {
          return this.setCallbackHelper('dataCallback', callback);
        },

        /*
   * Set the shouldSendCallback option
   *
   * @param {function} callback The callback to run which allows
   *                            introspecting the blob before sending
   * @return {Raven}
   */
        setShouldSendCallback: function(callback) {
          return this.setCallbackHelper('shouldSendCallback', callback);
        },

        requestHandler: function() {
          var self = this;
          return function(req, res, next) {
            self.context({req: req}, function() {
              domain.active.add(req);
              domain.active.add(res);
              next();
            });
          };
        },

        errorHandler: function() {
          var self = this;
          return function(err, req, res, next) {
            var status = err.status || err.statusCode || err.status_code || 500;

            // skip anything not marked as an internal server error
            if (status < 500) return next(err);

            var eventId = self.captureException(err, {req: req});
            res.sentry = eventId;
            return next(err);
          };
        },

        captureBreadcrumb: function(breadcrumb) {
          // Avoid capturing global-scoped breadcrumbs before instrumentation finishes
          if (!this.installed) return;

          breadcrumb = extend(
            {
              timestamp: +new Date() / 1000,
            },
            breadcrumb
          );
          var currCtx = this.getContext();
          if (!currCtx.breadcrumbs) currCtx.breadcrumbs = [];
          currCtx.breadcrumbs.push(breadcrumb);
          if (currCtx.breadcrumbs.length > this.maxBreadcrumbs) {
            currCtx.breadcrumbs.shift();
          }
          this.setContext(currCtx);
        },

        _createRequestObject: function() {
          /**
     * When using proxy, some of the attributes of req/request objects are non-enumerable.
     * To make sure, that they are still available to us after we consolidate our sources
     * (eg. globalContext.request + domainContext.request + kwargs.request),
     * we manually pull them out from original objects.
     *
     * We don't use Object.assign/extend as it's only merging over objects own properties,
     * and we don't want to go through all of the properties as well, as we simply don't
     * need all of them.
     *
     * So far the only missing piece is `ip`, but we can specify what properties should
     * be pulled by extending `nonEnumerables` array.
     **/
          var sources = Array.from(arguments).filter(function(source) {
            return Object.prototype.toString.call(source) === '[object Object]';
          });
          sources = [{}].concat(sources);
          var request = extend.apply(null, sources);
          var nonEnumberables = ['ip'];

          nonEnumberables.forEach(function(key) {
            sources.forEach(function(source) {
              if (source[key]) request[key] = source[key];
            });
          });

          return request;
        },
      });

      // Maintain old API compat, need to make sure arguments length is preserved
      function Client(dsn, options) {
        if (dsn instanceof Client) return dsn;
        var ravenInstance = new Raven();
        return ravenInstance.config.apply(ravenInstance, arguments);
      }
      nodeUtil.inherits(Client, Raven);

      // Singleton-by-default but not strictly enforced
      // todo these extra export props are sort of an adhoc mess, better way to manage?
      var defaultInstance = new Raven();
      defaultInstance.Client = Client;
      defaultInstance.version = __webpack_require__(11).version;
      defaultInstance.disableConsoleAlerts = utils.disableConsoleAlerts;

      module.exports = defaultInstance;

      /***/
    },
    /* 18 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict';
      /*!
 * cookie
 * Copyright(c) 2012-2014 Roman Shtylman
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

      /**
 * Module exports.
 * @public
 */

      exports.parse = parse;
      exports.serialize = serialize;

      /**
 * Module variables.
 * @private
 */

      var decode = decodeURIComponent;
      var encode = encodeURIComponent;
      var pairSplitRegExp = /; */;

      /**
 * RegExp to match field-content in RFC 7230 sec 3.2
 *
 * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 * field-vchar   = VCHAR / obs-text
 * obs-text      = %x80-FF
 */

      var fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;

      /**
 * Parse a cookie header.
 *
 * Parse the given cookie header string into an object
 * The object has the various cookies as keys(names) => values
 *
 * @param {string} str
 * @param {object} [options]
 * @return {object}
 * @public
 */

      function parse(str, options) {
        if (typeof str !== 'string') {
          throw new TypeError('argument str must be a string');
        }

        var obj = {};
        var opt = options || {};
        var pairs = str.split(pairSplitRegExp);
        var dec = opt.decode || decode;

        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i];
          var eq_idx = pair.indexOf('=');

          // skip things that don't look like key=value
          if (eq_idx < 0) {
            continue;
          }

          var key = pair.substr(0, eq_idx).trim();
          var val = pair.substr(++eq_idx, pair.length).trim();

          // quoted values
          if ('"' == val[0]) {
            val = val.slice(1, -1);
          }

          // only assign once
          if (undefined == obj[key]) {
            obj[key] = tryDecode(val, dec);
          }
        }

        return obj;
      }

      /**
 * Serialize data into a cookie header.
 *
 * Serialize the a name value pair into a cookie string suitable for
 * http headers. An optional options object specified cookie parameters.
 *
 * serialize('foo', 'bar', { httpOnly: true })
 *   => "foo=bar; httpOnly"
 *
 * @param {string} name
 * @param {string} val
 * @param {object} [options]
 * @return {string}
 * @public
 */

      function serialize(name, val, options) {
        var opt = options || {};
        var enc = opt.encode || encode;

        if (typeof enc !== 'function') {
          throw new TypeError('option encode is invalid');
        }

        if (!fieldContentRegExp.test(name)) {
          throw new TypeError('argument name is invalid');
        }

        var value = enc(val);

        if (value && !fieldContentRegExp.test(value)) {
          throw new TypeError('argument val is invalid');
        }

        var str = name + '=' + value;

        if (null != opt.maxAge) {
          var maxAge = opt.maxAge - 0;
          if (isNaN(maxAge)) throw new Error('maxAge should be a Number');
          str += '; Max-Age=' + Math.floor(maxAge);
        }

        if (opt.domain) {
          if (!fieldContentRegExp.test(opt.domain)) {
            throw new TypeError('option domain is invalid');
          }

          str += '; Domain=' + opt.domain;
        }

        if (opt.path) {
          if (!fieldContentRegExp.test(opt.path)) {
            throw new TypeError('option path is invalid');
          }

          str += '; Path=' + opt.path;
        }

        if (opt.expires) {
          if (typeof opt.expires.toUTCString !== 'function') {
            throw new TypeError('option expires is invalid');
          }

          str += '; Expires=' + opt.expires.toUTCString();
        }

        if (opt.httpOnly) {
          str += '; HttpOnly';
        }

        if (opt.secure) {
          str += '; Secure';
        }

        if (opt.sameSite) {
          var sameSite =
            typeof opt.sameSite === 'string' ? opt.sameSite.toLowerCase() : opt.sameSite;

          switch (sameSite) {
            case true:
              str += '; SameSite=Strict';
              break;
            case 'lax':
              str += '; SameSite=Lax';
              break;
            case 'strict':
              str += '; SameSite=Strict';
              break;
            default:
              throw new TypeError('option sameSite is invalid');
          }
        }

        return str;
      }

      /**
 * Try decoding a string using a decoding function.
 *
 * @param {string} str
 * @param {function} decode
 * @private
 */

      function tryDecode(str, decode) {
        try {
          return decode(str);
        } catch (e) {
          return str;
        }
      }

      /***/
    },
    /* 19 */
    /***/ function(module, exports, __webpack_require__) {
      'use strict';

      module.exports = function(req, time) {
        if (req.timeoutTimer) {
          return req;
        }

        var delays = isNaN(time) ? time : {socket: time, connect: time};
        var host = req._headers ? ' to ' + req._headers.host : '';

        if (delays.connect !== undefined) {
          req.timeoutTimer = setTimeout(function timeoutHandler() {
            req.abort();
            var e = new Error('Connection timed out on request' + host);
            e.code = 'ETIMEDOUT';
            req.emit('error', e);
          }, delays.connect);
        }

        // Clear the connection timeout timer once a socket is assigned to the
        // request and is connected.
        req.on('socket', function assign(socket) {
          // Socket may come from Agent pool and may be already connected.
          if (!(socket.connecting || socket._connecting)) {
            connect();
            return;
          }

          socket.once('connect', connect);
        });

        function clear() {
          if (req.timeoutTimer) {
            clearTimeout(req.timeoutTimer);
            req.timeoutTimer = null;
          }
        }

        function connect() {
          clear();

          if (delays.socket !== undefined) {
            // Abort the request if there is no activity on the socket for more
            // than `delays.socket` milliseconds.
            req.setTimeout(delays.socket, function socketTimeoutHandler() {
              req.abort();
              var e = new Error('Socket timed out on request' + host);
              e.code = 'ESOCKETTIMEDOUT';
              req.emit('error', e);
            });
          }
        }

        return req.on('error', clear);
      };

      /***/
    },
    /* 20 */
    /***/ function(module, exports) {
      module.exports = require('https');

      /***/
    },
    /* 21 */
    /***/ function(module, exports, __webpack_require__) {
      // builtin
      var fs = __webpack_require__(8);
      var path = __webpack_require__(2);

      // node 0.6 support
      fs.existsSync = fs.existsSync || path.existsSync;

      // main_paths are the paths where our mainprog will be able to load from
      // we store these to avoid grabbing the modules that were loaded as a result
      // of a dependency module loading its dependencies, we only care about deps our
      // mainprog loads
      var main_paths =
        (__webpack_require__.c[__webpack_require__.s] &&
          __webpack_require__.c[__webpack_require__.s].paths) ||
        [];

      module.exports = function() {
        var paths = Object.keys(__webpack_require__.c || []);

        // module information
        var infos = {};

        // paths we have already inspected to avoid traversing again
        var seen = {};

        paths.forEach(function(p) {
          var dir = p;

          (function updir() {
            var orig = dir;
            dir = path.dirname(orig);

            if (!dir || orig === dir || seen[orig]) {
              return;
            } else if (main_paths.indexOf(dir) < 0) {
              return updir();
            }

            var pkgfile = path.join(orig, 'package.json');
            var exists = fs.existsSync(pkgfile);

            seen[orig] = true;

            // travel up the tree if no package.json here
            if (!exists) {
              return updir();
            }

            try {
              var info = JSON.parse(fs.readFileSync(pkgfile, 'utf8'));
              infos[info.name] = info.version;
            } catch (e) {}
          })();
        });

        return infos;
      };

      /***/
    },
    /* 22 */
    /***/ function(module, exports) {
      exports.get = function(belowFn) {
        var oldLimit = Error.stackTraceLimit;
        Error.stackTraceLimit = Infinity;

        var dummyObject = {};

        var v8Handler = Error.prepareStackTrace;
        Error.prepareStackTrace = function(dummyObject, v8StackTrace) {
          return v8StackTrace;
        };
        Error.captureStackTrace(dummyObject, belowFn || exports.get);

        var v8StackTrace = dummyObject.stack;
        Error.prepareStackTrace = v8Handler;
        Error.stackTraceLimit = oldLimit;

        return v8StackTrace;
      };

      exports.parse = function(err) {
        if (!err.stack) {
          return [];
        }

        var self = this;
        var lines = err.stack.split('\n').slice(1);

        return lines
          .map(function(line) {
            if (line.match(/^\s*[-]{4,}$/)) {
              return self._createParsedCallSite({
                fileName: line,
                lineNumber: null,
                functionName: null,
                typeName: null,
                methodName: null,
                columnNumber: null,
                native: null,
              });
            }

            var lineMatch = line.match(
              /at (?:(.+)\s+)?\(?(?:(.+?):(\d+):(\d+)|([^)]+))\)?/
            );
            if (!lineMatch) {
              return;
            }

            var object = null;
            var method = null;
            var functionName = null;
            var typeName = null;
            var methodName = null;
            var isNative = lineMatch[5] === 'native';

            if (lineMatch[1]) {
              var methodMatch = lineMatch[1].match(/([^\.]+)(?:\.(.+))?/);
              object = methodMatch[1];
              method = methodMatch[2];
              functionName = lineMatch[1];
              typeName = 'Object';
            }

            if (method) {
              typeName = object;
              methodName = method;
            }

            if (method === '<anonymous>') {
              methodName = null;
              functionName = '';
            }

            var properties = {
              fileName: lineMatch[2] || null,
              lineNumber: parseInt(lineMatch[3], 10) || null,
              functionName: functionName,
              typeName: typeName,
              methodName: methodName,
              columnNumber: parseInt(lineMatch[4], 10) || null,
              native: isNative,
            };

            return self._createParsedCallSite(properties);
          })
          .filter(function(callSite) {
            return !!callSite;
          });
      };

      exports._createParsedCallSite = function(properties) {
        var methods = {};
        for (var property in properties) {
          var prefix = 'get';
          if (property === 'native') {
            prefix = 'is';
          }
          var method = prefix + property.substr(0, 1).toUpperCase() + property.substr(1);

          (function(property) {
            methods[method] = function() {
              return properties[property];
            };
          })(property);
        }

        var callSite = Object.create(methods);
        for (var property in properties) {
          callSite[property] = properties[property];
        }

        return callSite;
      };

      /***/
    },
    /* 23 */
    /***/ function(module, exports) {
      module.exports = require('zlib');

      /***/
    },
    /* 24 */
    /***/ function(module, exports, __webpack_require__) {
      // Unique ID creation requires a high quality random # generator.  We feature
      // detect to determine the best RNG source, normalizing to a function that
      // returns 128-bits of randomness, since that's what's usually required
      var _rng = __webpack_require__(25);

      // Maps for number <-> hex string conversion
      var _byteToHex = [];
      var _hexToByte = {};
      for (var i = 0; i < 256; ++i) {
        _byteToHex[i] = (i + 0x100).toString(16).substr(1);
        _hexToByte[_byteToHex[i]] = i;
      }

      function buff_to_string(buf, offset) {
        var i = offset || 0;
        var bth = _byteToHex;
        return (
          bth[buf[i++]] +
          bth[buf[i++]] +
          bth[buf[i++]] +
          bth[buf[i++]] +
          '-' +
          bth[buf[i++]] +
          bth[buf[i++]] +
          '-' +
          bth[buf[i++]] +
          bth[buf[i++]] +
          '-' +
          bth[buf[i++]] +
          bth[buf[i++]] +
          '-' +
          bth[buf[i++]] +
          bth[buf[i++]] +
          bth[buf[i++]] +
          bth[buf[i++]] +
          bth[buf[i++]] +
          bth[buf[i++]]
        );
      }

      // **`v1()` - Generate time-based UUID**
      //
      // Inspired by https://github.com/LiosK/UUID.js
      // and http://docs.python.org/library/uuid.html

      // random #'s we need to init node and clockseq
      var _seedBytes = _rng();

      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      var _nodeId = [
        _seedBytes[0] | 0x01,
        _seedBytes[1],
        _seedBytes[2],
        _seedBytes[3],
        _seedBytes[4],
        _seedBytes[5],
      ];

      // Per 4.2.2, randomize (14 bit) clockseq
      var _clockseq = ((_seedBytes[6] << 8) | _seedBytes[7]) & 0x3fff;

      // Previous uuid creation time
      var _lastMSecs = 0,
        _lastNSecs = 0;

      // See https://github.com/broofa/node-uuid for API details
      function v1(options, buf, offset) {
        var i = (buf && offset) || 0;
        var b = buf || [];

        options = options || {};

        var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

        // UUID timestamps are 100 nano-second units since the Gregorian epoch,
        // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
        // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
        // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
        var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

        // Per 4.2.1.2, use count of uuid's generated during the current clock
        // cycle to simulate higher resolution clock
        var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

        // Time since last uuid creation (in msecs)
        var dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000;

        // Per 4.2.1.2, Bump clockseq on clock regression
        if (dt < 0 && options.clockseq === undefined) {
          clockseq = (clockseq + 1) & 0x3fff;
        }

        // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
        // time interval
        if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
          nsecs = 0;
        }

        // Per 4.2.1.2 Throw error if too many uuids are requested
        if (nsecs >= 10000) {
          throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
        }

        _lastMSecs = msecs;
        _lastNSecs = nsecs;
        _clockseq = clockseq;

        // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
        msecs += 12219292800000;

        // `time_low`
        var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
        b[i++] = (tl >>> 24) & 0xff;
        b[i++] = (tl >>> 16) & 0xff;
        b[i++] = (tl >>> 8) & 0xff;
        b[i++] = tl & 0xff;

        // `time_mid`
        var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
        b[i++] = (tmh >>> 8) & 0xff;
        b[i++] = tmh & 0xff;

        // `time_high_and_version`
        b[i++] = ((tmh >>> 24) & 0xf) | 0x10; // include version
        b[i++] = (tmh >>> 16) & 0xff;

        // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
        b[i++] = (clockseq >>> 8) | 0x80;

        // `clock_seq_low`
        b[i++] = clockseq & 0xff;

        // `node`
        var node = options.node || _nodeId;
        for (var n = 0; n < 6; ++n) {
          b[i + n] = node[n];
        }

        return buf ? buf : buff_to_string(b);
      }

      // **`v4()` - Generate random UUID**

      // See https://github.com/broofa/node-uuid for API details
      function v4(options, buf, offset) {
        // Deprecated - 'format' argument, as supported in v1.2
        var i = (buf && offset) || 0;

        if (typeof options == 'string') {
          buf = options == 'binary' ? new Array(16) : null;
          options = null;
        }
        options = options || {};

        var rnds = options.random || (options.rng || _rng)();

        // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
        rnds[6] = (rnds[6] & 0x0f) | 0x40;
        rnds[8] = (rnds[8] & 0x3f) | 0x80;

        // Copy bytes to buffer, if provided
        if (buf) {
          for (var ii = 0; ii < 16; ++ii) {
            buf[i + ii] = rnds[ii];
          }
        }

        return buf || buff_to_string(rnds);
      }

      // Export public API
      var uuid = v4;
      uuid.v1 = v1;
      uuid.v4 = v4;

      module.exports = uuid;

      /***/
    },
    /* 25 */
    /***/ function(module, exports, __webpack_require__) {
      var rb = __webpack_require__(26).randomBytes;
      module.exports = function() {
        return rb(16);
      };

      /***/
    },
    /* 26 */
    /***/ function(module, exports) {
      module.exports = require('crypto');

      /***/
    },
    /* 27 */
    /***/ function(module, exports) {
      module.exports = require('domain');

      /***/
    },
    /* 28 */
    /***/ function(module, exports) {
      module.exports = require('module');

      /***/
    },
    /* 29 */
    /***/ function(module, exports, __webpack_require__) {
      var map = {
        './console': 12,
        './console.js': 12,
        './http': 13,
        './http.js': 13,
        './instrumentor': 4,
        './instrumentor.js': 4,
        './pg': 14,
        './pg.js': 14,
      };
      function webpackContext(req) {
        return __webpack_require__(webpackContextResolve(req));
      }
      function webpackContextResolve(req) {
        var id = map[req];
        if (!(id + 1))
          // check for number or string
          throw new Error("Cannot find module '" + req + "'.");
        return id;
      }
      webpackContext.keys = function webpackContextKeys() {
        return Object.keys(map);
      };
      webpackContext.resolve = webpackContextResolve;
      module.exports = webpackContext;
      webpackContext.id = 29;

      /***/
    },
    /* 30 */
    /***/ function(module, exports) {
      module.exports = require('console');

      /***/
    },
    /* 31 */
    /***/ function(module, exports) {
      module.exports = require('os');

      /***/
    },
    /* 32 */
    /***/ function(module, exports, __webpack_require__) {
      var bar = __webpack_require__(33);

      function foo() {
        bar();
      }

      module.exports = foo;

      /***/
    },
    /* 33 */
    /***/ function(module, exports, __webpack_require__) {
      var path = __webpack_require__(2);

      module.exports = function bar() {
        throw new Error(path.join('foo', 'bar'));
      };

      /***/
    },
    /******/
  ]
);
//# sourceMappingURL=dist.bundle.js.map
