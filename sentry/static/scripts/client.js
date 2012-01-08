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
        logger: 'javascript',
        site: 'sentry.web'
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
        data.site = self.options.site;

        var req = new XMLHttpRequest();
        // req.setRequestHeader('User-Agent', 'Sentry:JS/1.0');
        // req.setRequestHeader('Content-type', 'application/json');
        // req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        req.open('POST', self.options.server + '?project_id=' + self.options.projectId, false);
        req.send(JSON.stringify(data));
    };

    Sentry.client.parseTraceback = function(tb) {
        // first line is simply the repeated message:
        // ReferenceError: aldfjalksdjf is not defined

        // following lines (in Chrome at least) contain
        // a line of context
        //     at http://localhost:9000/1/group/306:41:5
        var stack = [];
        var lines = tb.split('\n');
        for (var i=1, line; (line = lines[i]); i++) {
            var chunks = line.split(':');
            var lineno = chunks.slice(-2)[0];
            var filename = chunks.slice(0, -2).join(':').split(' at ')[1];
            stack.push({
                'lineno': lineno,
                'filename': filename
            });
        }
        return stack;
    };

    Sentry.client.captureException = function(e) {
        var lineno;
        var url = window.location.href;
        var traceback;
        var stack;
        var headers;
        var fileurl;

        if (e.line) { // WebKit
            lineno = e.line;
        } else if (e.lineNumber) { // Mozilla
            lineno = e.lineNumber;
        }

        if (e.sourceURL) { // Webkit
            fileurl = e.sourceURL;
        } else if (e.fileName) { // Mozilla
            fileurl = e.fileName;
        }
        if (e.stack) {
            try {
                traceback = self.parseTraceback(e.stack);
            } catch (ex) {

            }
        }

        var urlparts = self.parseUrl(url);
        var label = e.toString();
        if (lineno) {
            label = label + " at " + lineno;
        }

        if (traceback) {
            stack = {
                "frames": traceback
            };
            fileurl = traceback[0].filename;
        } else if (fileurl) {
            stack = {
                "frames": [
                    {
                        "filename": fileurl,
                        "lineno": lineno
                    }
                ]
            };
        }

        var data = {
            "message": label,
            "culprit": fileurl || undefined,
            "sentry.interfaces.Stacktrace": stack || undefined,
            "sentry.interfaces.Exception": {
                "type": e.name,
                "value": e.message
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

        window.onerror = function(message, fileurl, lineno, stack) {
            var url = window.location.href;
            var urlparts = self.parseUrl(url);
            var label = message + ' at line ' + lineno;
            var data = {
                "message": label,
                "culprit": fileurl,
                "sentry.interfaces.Stacktrace": {
                    "frames": [
                        {
                            "filename": fileurl,
                            "lineno": lineno
                        }
                    ]
                },
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
