// Originally based on the Arecibo JavaScript client

if (Sentry === undefined) {
    var Sentry = {};
}
(function(){
    Sentry.client = {};

    var self = Sentry.client;

    Sentry.client.loaded = false;
    Sentry.client.options = {
        fetchHeaders: false,
        publicKey: null,
        server: '/sentry/store/', // JS client only supports a single server
        projectId: 1,
        logger: 'javascript'
    };

    Sentry.client.config = function(data){
        for (var k in data) {
            self.options[k] = data[k];
        }
    };

    Sentry.client.parseUrl = function(url) {
        var url_parts = url.split('?');
        var querystring = url_parts[1];

        return {
            url: url_parts[0],
            querystring: url_parts[1]
        };
    };

    Sentry.client.getHeaders = function() {
        if (self.options.fetchHeaders) {
            var req = new XMLHttpRequest();
            req.open('HEAD', document.location, false);
            req.send(null);
            headers = req.getAllResponseHeaders().toLowerCase();
        } else {
            headers = {
                "Referer": document.referrer,
                "User-Agent": navigator.userAgent
            };
        }
        return headers;
    };

    Sentry.client.addEvent = function(elem, event, func) {
        if (elem.addEventListener) {
            elem.addEventListener(event, func, false);
            return true;
        } else if (elem.attachEvent) {
            var result = elem.attachEvent("on"+event, func);
            return result;
        }
        return false;
    };

    Sentry.client.process = function(data) {
        data.project = self.options.projectId;
        data.logger = self.options.logger;

        var req = new XMLHttpRequest();
        // req.setRequestHeader('User-Agent', 'Sentry:JS/1.0');
        // req.setRequestHeader('Content-type', 'application/json');
        // req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        req.open('POST', self.options.server + '?project_id=' + self.options.projectId, false);
        console.log(JSON.stringify(data));
        req.send(JSON.stringify(data));
    };

    Sentry.client.captureException = function(e) {
        var lineno;
        var url;
        var traceback;
        var headers;
        var message = e.toString();

        if (e.line) { // WebKit
            lineno = e.line;
        } else if (e.lineNumber) { // Mozilla
            lineno = e.lineNumber;
        }

        if (e.sourceURL) { // Webkit
            url = e.sourceURL;
        } else if (e.fileName) { // Mozilla
            url = e.fileName;
        } else {
            url = window.location;
        }

        // Currently Mozilla only:
        if (e.stack) {
            traceback = e.stack;
        }

        var urlparts = self.parseUrl(url);

        var data = {
            "message": e.name + ": " + message,
            // "sentry.interfaces.Stacktrace": {
            //     "frames": [
            //         {
            //             "lineno": lineno
            //         }
            //     ]
            // },
            "sentry.interfaces.Exception": {
                "type": e.name,
                "value": message
            },
            "sentry.interfaces.Http": {
                "url": urlparts.url,
                "querystring": urlparts.querystring,
                "headers": self.getHeaders()
            }
        };

        self.process(data);
    };

    Sentry.client.registerGlobalHandler = function() {
        /*
            NOTE: Currently this will only work on Firefox and Internet Explorer.

            Safari and Chrome have open feature requests for global error handlers:

            https://bugs.webkit.org/show_bug.cgi?id=8519
            http://code.google.com/p/chromium/issues/detail?id=7771
        */

        window.onerror = function(message, url, lineno, stack) {
            var urlparts = self.parseUrl(url);
            var data = {
                "message": message,
                // "sentry.interfaces.Stacktrace": {
                //     "frames": [
                //         {
                //             "lineno": lineno
                //         }
                //     ]
                // },
                "sentry.interfaces.Exception": {
                    "value": message
                },
                "sentry.interfaces.Http": {
                    "url": urlparts.url,
                    "querystring": urlparts.querystring,
                    "headers": self.getHeaders()
                }
            };
            self.process(data);
        };
    };
}());