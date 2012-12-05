// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License

function parseUri (str) {
  var o   = parseUri.options,
    m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
    uri = {},
    i   = 14;

  while (i--) uri[o.key[i]] = m[i] || "";

  uri[o.q.name] = {};
  uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
    if ($1) uri[o.q.name][$1] = $2;
  });

  return uri;
}

parseUri.options = {
  strictMode: false,
  key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
  q:   {
    name:   "queryKey",
    parser: /(?:^|&)([^&=]*)=?([^&]*)/g
  },
  parser: {
    strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
    loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
  }
};
// Raven.js
//
// Originally based on the Arecibo JavaScript client.
//
// Requires:
//     * Either jQuery (>1.5) or Zepto.js (>0.8).
//     * parseUri (included in the full and minified distribution files)

(function(){
    // Save a reference to the global object (`window` in the browser, `global`
    // on the server).
    "use strict";

    var root = this;

    var Raven;
    root.Raven = Raven = {};

    var self = Raven;

    Raven.VERSION = '0.7.1';

    // jQuery, Zepto, or Ender owns the `$` variable.
    var $ = root.jQuery || root.Zepto || root.ender;
    if (typeof($) === 'undefined') {
        throw "Raven requires one of the following libraries: jQuery, Zepto, or ender";
    }
    if (root.jQuery === $ && $.fn.jquery < '1.5.0') {
        throw "A newer version of jQuery is required";
    }

    Raven.options = {
        secretKey: undefined,  // The global key if not using project auth
        publicKey: undefined,  // Leave as undefined if not using project auth
        servers: [],
        projectId: 1,
        logger: 'javascript',
        site: undefined,
        dataCallback: null,
        signatureUrl: undefined,
        fetchHeaders: false,  // Generates a synchronous request to your server
        testMode: false,  // Disables some things that randomize the signature
        ignoreErrors: [],
        ignoreUrls: []
    };

    Raven.funcNameRE = /function\s*([\w\-$]+)?\s*\(/i;

    Raven.config = function(config) {
        var servers = [];

        if (typeof(config) === "string") {
            if (config.indexOf('http') === 0) {
                // new-style DSN configuration
                config = Raven.parseDSN(config);
            } else {
                throw "Base64 encoded config is no longer supported - use DSN";
            }
        }

        $.each(config, function(key, option) {
            self.options[key] = option;
        });

        // Expand server base URLs into API URLs
        $.each(self.options.servers, function(i, server) {
            // Add a trailing slash if one isn't provided
            if (server.slice(-1) !== '/') {
                server += '/';
            }
            servers.push(server + 'api/' + self.options.projectId + '/store/');
        });
        self.options.servers = servers;

    };

    Raven.parseDSN = function(dsn) {
        var uri = parseUri(dsn);
        var path_idx = uri.path.lastIndexOf('/');
        var project_id;
        var path;

        if (path_idx === -1) {
            project_id = uri.path.substr(1);
            path = '';
        } else {
            path = uri.path.substr(1, path_idx);
            project_id = uri.path.substr(path_idx + 1);
        }

        return {
            servers: [uri.protocol + '://' + uri.host + ':' + uri.port + '/' + path],
            publicKey: uri.user,
            secretKey: uri.password,
            projectId: project_id
        };
    };

    Raven.getHeaders = function() {
        var headers = {};

        if (self.options.fetchHeaders && !self.options.testMode) {
            headers = $.ajax({
                type: 'HEAD',
                url: root.location,
                async: false
            }).getAllResponseHeaders();
        }

        headers.Referer = document.referrer;
        headers["User-Agent"] = navigator.userAgent;
        return headers;
    };

    Raven.parseHeaders = function(headers_string) {
        /*
         * Parse the header string returned from getAllResponseHeaders
         */
        var headers = {};
        $.each(headers_string.split('\n'), function(i, header) {
            var name = header.slice(0, header.indexOf(':')),
                value = header.slice(header.indexOf(':') + 2);
            headers[name] = value;
        });
        return headers;
    };

    Raven.getSignature = function(message, timestamp, callback) {
        if (self.options.signatureUrl) {
            $.ajax({
                type: 'POST',
                url: self.options.signatureUrl,
                data: {
                    message: message,
                    timestamp: timestamp
                },
                dataType: 'json',
                success: function(data) {
                    callback(data.signature);
                }
            });
        } else {
            callback();
        }
    };

    Raven.getAuthHeader = function(signature, timestamp) {
        var header = "Sentry sentry_version=2.0, ";
        header += "sentry_timestamp=" + timestamp + ", ";
        header += "sentry_client=raven-js/" + self.VERSION;
        if (self.options.publicKey) {
            header += ", sentry_key=" + self.options.publicKey;
        }
        if (signature) {
            header += ", sentry_signature=" + signature;
        }
        return header;
    };

    Raven.captureException = function(e, options) {
        var label, lineno, fileurl, traceback;

        if (e.line) {  // WebKit
            lineno = e.line;
        } else if (e.lineNumber) {  // Mozilla
            lineno = e.lineNumber;
        }

        if (e.sourceURL) {  // Webkit
            fileurl = e.sourceURL;
        } else if (e.fileName) {  // Mozilla
            fileurl = e.fileName;
        }

        if (e["arguments"] && e.stack) {
            traceback = self.chromeTraceback(e);
        } else if (e.stack) {
            // Detect edge cases where Chrome doesn't have 'arguments'
            if (e.stack.indexOf('@') == -1) {
                traceback = self.chromeTraceback(e);
            } else {
                traceback = self.firefoxOrSafariTraceback(e);
            }
        } else {
            traceback = [{"filename": fileurl, "lineno": lineno}];
            traceback = traceback.concat(self.otherTraceback(Raven.captureException));
        }

        self.process(e, fileurl, lineno, traceback, options);
    };

    Raven.captureMessage = function(msg, options) {
        var data = self.arrayMerge({
            'message': msg
        }, options);
        
        self.send(data);
    };

    Raven.process = function(message, fileurl, lineno, traceback, options) {
        var type, stacktrace, label, data;

        if (typeof(message) === 'object') {
            type = message.name;
            message = message.message;
        }

        if ($.inArray(message, self.options.ignoreErrors) >= 0) {
            return;
        }


        if (traceback) {
            stacktrace = {"frames": traceback};
            fileurl = fileurl || traceback[0].filename;
        } else if (fileurl) {
            stacktrace = {
                "frames": [{
                    "filename": fileurl,
                    "lineno": lineno
                }]
            };
        }

        for (var i = 0; i < self.options.ignoreUrls.length; i++) {
            if (self.options.ignoreUrls[i].test(fileurl)) {
                return;
            }
        }

        label = lineno ? message + " at " + lineno : message;

        data = self.arrayMerge({
            "sentry.interfaces.Exception": {
                "type": type,
                "value": message
            },
            "sentry.interfaces.Stacktrace": stacktrace,
            "culprit": fileurl,
            "message": label
        }, options);

        self.send(data);
    };

    Raven.arrayMerge = function(arr1, arr2) {
        if (typeof(arr2) === "undefined") {
            return arr1;
        }
        $.each(arr2, function(key, value){
            arr1[key] = value;
        });
        return arr1;
    };

    Raven.trimString = function(str) {
        return str.replace(/^\s+|\s+$/g, "");
    };

    Raven.chromeTraceback = function(e) {
        /*
         * First line is simply the repeated message:
         *   ReferenceError: aldfjalksdjf is not defined
         *
         * Following lines contain error context:
         *   at http://localhost:9000/1/group/306:41:5
         */
        var chunks, fn, filename, lineno, fileBits,
            traceback = [],
            lines = e.stack.split('\n');
        $.each(lines.slice(1), function(i, line) {
            // Trim the 'at ' from the beginning, and split by spaces
            chunks = Raven.trimString(line).slice(3);
            if (chunks == "unknown source") {
                return;  // Skip this one
            } else {
                chunks = chunks.split(' ');
            }

            if (chunks.length > 2) {
                // If there are more than 2 chunks, there are spaces in the
                // filename
                fn = chunks[0];
                filename = chunks.slice(1).join(' ');
                lineno = '(unknown)';
            } else if (chunks.length == 2) {
                // If there are two chunks, the first one is the function name
                fn = chunks[0];
                filename = chunks[1];
            } else {
                fn = '(unknown)';
                filename = chunks[0];
            }

            if (filename && filename !== '(unknown source)') {
                if (filename[0] === '(') {
                    // Remove parentheses
                    filename = filename.slice(1, -1);
                }
                // filename should be: <scheme>://<uri>:<line>:<column>
                // where :<column> is optional
                fileBits = filename.split(':');
                lineno = fileBits[2];
                filename = fileBits.slice(0, 2).join(':');
            }

            traceback.push({
                'function': fn,
                'filename': filename,
                'lineno': lineno
            });
        });
        return traceback;
    };

    Raven.firefoxOrSafariTraceback = function(e) {
        /*
         * Each line is a function with args and a filename, separated by an ampersand.
         *   unsubstantiatedClaim("I am Batman")@http://raven-js.com/test/exception.js:7
         *
         * Anonymous functions are presented without a name, but including args.
         *   (66)@http://raven-js.com/test/vendor/qunit.js:418
         *
         */
        var chunks, fn, args, filename, lineno,
            traceback = [],
            lines = e.stack.split('\n');
        $.each(lines, function(i, line) {
            if (line) {
                chunks = line.split('@');
                if (chunks[0]) {
                    fn = chunks[0].split('(');

                    if (fn.length > 1 && fn[1] != ')') {
                        args = fn[1].slice(0, -1).split(',');
                    } else {
                        args = undefined;
                    }

                    if (fn[0]) {
                        fn = fn[0];
                    } else {
                        fn = '(unknown)';
                    }
                } else {
                    fn = '(unknown)';
                }

                if (chunks.length > 1) {
                    filename = chunks[1].split(':');
                    lineno = filename.slice(-1)[0];
                    filename = filename.slice(0, -1).join(':');
                } else if (chunks[0] == '[native code]') {
                    fn = '(unknown)';
                    filename = '[native code]';
                    lineno = 0;
                    args = undefined;
                }

                traceback.push({
                    'function': fn,
                    'filename': filename,
                    'lineno': lineno,
                    'vars': {'arguments': args}
                });
            }
        });
        return traceback;
    };

    Raven.otherTraceback = function(callee) {
        /*
         * Generates best-efforts tracebacks for other browsers, such as Safari
         * or IE.
         */
        var fn, args,
            ANON = '<anonymous>',
            traceback = [],
            max = 9;
        while (callee && traceback.length < max) {
            fn = callee.name || (self.funcNameRE.test(callee.toString()) ? RegExp.$1 || ANON : ANON);
            if (callee["arguments"]) {
                args = self.stringifyArguments(callee["arguments"]);
            } else {
                args = undefined;
            }
            traceback.push({
                'filename': '(unknown source)',
                'lineno': '(unknown)',
                'function': fn,
                'post_context': callee.toString().split('\n'),
                'vars': {'arguments': args}
            });
            callee = callee.caller;
        }
        return traceback;
    };

    Raven.stringifyArguments = function(args) {
        /*
         * Converts a callee's arguments to strings
         */
        var fn,
            self = this,
            UNKNOWN = '<unknown>',
            results = [];

        $.each(args, function(i, arg) {
            if (arg === undefined) {
                results.push('undefined');
            } else if (arg === null) {
                results.push('null');
            } else if (arg instanceof Array) {
                results.push(self.stringifyArguments(arg));
            } else if (arg.constructor) {
                fn = arg.constructor.name || (self.funcNameRE.test(arg.constructor.toString()) ? RegExp.$1 || UNKNOWN : UNKNOWN);
                if (fn == 'String') {
                    results.push('"' + arg + '"');
                } else if (fn == 'Number' || fn == 'Date') {
                    results.push(arg);
                } else if (fn == 'Boolean') {
                    results.push(arg ? 'true' : 'false');
                } else {
                    results.push(fn);
                }
            } else {
                results.push(UNKNOWN);
            }
        });

        return results;
    };

    Raven.pad = function(n, amount) {
        var i,
            len = ('' + n).length;
        if (typeof(amount) === "undefined") {
            amount = 2;
        }
        if (len >= amount) {
            return n;
        }
        for (i=0; i < (amount - len); i++) {
            n = '0' + n;
        }
        return n;
    };

    Raven.dateToISOString = function(date) {
        if (Date.prototype.toISOString) {
            return date.toISOString();
        }
        
        return date.getUTCFullYear() + '-' +
            self.pad(date.getUTCMonth() + 1) + '-' +
            self.pad(date.getUTCDate()) + 'T' +
            self.pad(date.getUTCHours()) + ':' +
            self.pad(date.getUTCMinutes()) + ':' +
            self.pad(date.getUTCSeconds()) + '.' +
            self.pad(date.getUTCMilliseconds(), 3) + 'Z';
    };

    Raven.send = function(data) {
        var encoded_msg,
            timestamp= new Date().getTime(),
            url = root.location.protocol + '//' + root.location.host + root.location.pathname,
            querystring = root.location.search.slice(1);  // Remove the ?

        data = self.arrayMerge({
            "project": self.options.projectId,
            "logger": self.options.logger,
            "site": self.options.site,
            "timestamp": new Date(),
            "sentry.interfaces.Http": {
                "url": url,
                "querystring": querystring,
                "headers": self.getHeaders()
            }
        }, data);

        if (typeof(self.options.dataCallback) == 'function') {
            data = self.options.dataCallback(data);
        }

        data.timestamp = self.dateToISOString(data.timestamp);

        encoded_msg = JSON.stringify(data);
        self.getSignature(encoded_msg, timestamp, function(signature) {
            var header = self.getAuthHeader(signature, timestamp);
            $.each(self.options.servers, function (i, server) {
                $.ajax({
                    type: 'POST',
                    url: server,
                    data: encoded_msg,
                    dataType: 'json',
                    headers: {
                        // We send both headers, since Authentication may be blocked,
                        // and custom headers arent supported in IE9
                        'X-Sentry-Auth': header,
                        'Authentication': header
                    }
                });
            });
        });
    };
}).call(this);
