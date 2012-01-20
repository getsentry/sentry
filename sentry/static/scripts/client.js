/*
 * Crypto-JS v2.5.3
 * http://code.google.com/p/crypto-js/
 * (c) 2009-2012 by Jeff Mott. All rights reserved.
 * http://code.google.com/p/crypto-js/wiki/License
 */
(typeof Crypto=="undefined"||!Crypto.util)&&function(){var e=window.Crypto={},k=e.util={rotl:function(b,c){return b<<c|b>>>32-c},rotr:function(b,c){return b<<32-c|b>>>c},endian:function(b){if(b.constructor==Number)return k.rotl(b,8)&16711935|k.rotl(b,24)&4278255360;for(var c=0;c<b.length;c++)b[c]=k.endian(b[c]);return b},randomBytes:function(b){for(var c=[];b>0;b--)c.push(Math.floor(Math.random()*256));return c},bytesToWords:function(b){for(var c=[],a=0,i=0;a<b.length;a++,i+=8)c[i>>>5]|=(b[a]&255)<<
24-i%32;return c},wordsToBytes:function(b){for(var c=[],a=0;a<b.length*32;a+=8)c.push(b[a>>>5]>>>24-a%32&255);return c},bytesToHex:function(b){for(var c=[],a=0;a<b.length;a++)c.push((b[a]>>>4).toString(16)),c.push((b[a]&15).toString(16));return c.join("")},hexToBytes:function(b){for(var c=[],a=0;a<b.length;a+=2)c.push(parseInt(b.substr(a,2),16));return c},bytesToBase64:function(b){if(typeof btoa=="function")return btoa(d.bytesToString(b));for(var c=[],a=0;a<b.length;a+=3)for(var i=b[a]<<16|b[a+1]<<
8|b[a+2],l=0;l<4;l++)a*8+l*6<=b.length*8?c.push("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(i>>>6*(3-l)&63)):c.push("=");return c.join("")},base64ToBytes:function(b){if(typeof atob=="function")return d.stringToBytes(atob(b));for(var b=b.replace(/[^A-Z0-9+\/]/ig,""),c=[],a=0,i=0;a<b.length;i=++a%4)i!=0&&c.push(("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(b.charAt(a-1))&Math.pow(2,-2*i+8)-1)<<i*2|"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(b.charAt(a))>>>
6-i*2);return c}},e=e.charenc={};e.UTF8={stringToBytes:function(b){return d.stringToBytes(unescape(encodeURIComponent(b)))},bytesToString:function(b){return decodeURIComponent(escape(d.bytesToString(b)))}};var d=e.Binary={stringToBytes:function(b){for(var c=[],a=0;a<b.length;a++)c.push(b.charCodeAt(a)&255);return c},bytesToString:function(b){for(var c=[],a=0;a<b.length;a++)c.push(String.fromCharCode(b[a]));return c.join("")}}}();
(function(){var e=Crypto,k=e.util,d=e.charenc,b=d.UTF8,c=d.Binary,a=e.SHA1=function(b,l){var f=k.wordsToBytes(a._sha1(b));return l&&l.asBytes?f:l&&l.asString?c.bytesToString(f):k.bytesToHex(f)};a._sha1=function(a){a.constructor==String&&(a=b.stringToBytes(a));var c=k.bytesToWords(a),f=a.length*8,a=[],e=1732584193,g=-271733879,d=-1732584194,j=271733878,m=-1009589776;c[f>>5]|=128<<24-f%32;c[(f+64>>>9<<4)+15]=f;for(f=0;f<c.length;f+=16){for(var p=e,q=g,r=d,s=j,t=m,h=0;h<80;h++){if(h<16)a[h]=c[f+h];else{var n=
a[h-3]^a[h-8]^a[h-14]^a[h-16];a[h]=n<<1|n>>>31}n=(e<<5|e>>>27)+m+(a[h]>>>0)+(h<20?(g&d|~g&j)+1518500249:h<40?(g^d^j)+1859775393:h<60?(g&d|g&j|d&j)-1894007588:(g^d^j)-899497514);m=j;j=d;d=g<<30|g>>>2;g=e;e=n}e+=p;g+=q;d+=r;j+=s;m+=t}return[e,g,d,j,m]};a._blocksize=16;a._digestsize=20})();
(function(){var e=Crypto,k=e.util,d=e.charenc,b=d.UTF8,c=d.Binary;e.HMAC=function(a,e,d,f){e.constructor==String&&(e=b.stringToBytes(e));d.constructor==String&&(d=b.stringToBytes(d));d.length>a._blocksize*4&&(d=a(d,{asBytes:!0}));for(var o=d.slice(0),d=d.slice(0),g=0;g<a._blocksize*4;g++)o[g]^=92,d[g]^=54;a=a(o.concat(a(d.concat(e),{asBytes:!0})),{asBytes:!0});return f&&f.asBytes?a:f&&f.asString?c.bytesToString(a):k.bytesToHex(a)}})();

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
        secretKey: null,
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

    Sentry.client.getAuthHeader = function(message) {

        if (self.options.publicKey == null || self.options.secretKey == null) {
            return "";
        }

        var timestamp = (new Date().getTime() / 1000) + '000';

        var signature = Crypto.HMAC(Crypto.SHA1, timestamp + ' ' + message , self.options.secretKey);

        var headers = {
            'sentry_timestamp': timestamp,
            'sentry_signature': signature,
            'sentry_client': 'Sentry:JS/1.0',
            'sentry_key': self.options.publicKey
        };

        var elements = [];
        for (var key in headers) {
            elements.push(key + "=" + headers[key]);
        }

        return "Sentry " + elements.join(',');
    };

    Sentry.client.process = function(data) {
        data.project = self.options.projectId;
        data.logger = self.options.logger;
        data.site = self.options.site;

        var req = new XMLHttpRequest();
        var reqUrl = self.options.server + '?project_id=' + self.options.projectId;

        var message = JSON.stringify(data);
        var auth_header = self.getAuthHeader(message);
        if (!auth_header && self.options.publicKey && location.protocol == 'https') {
            reqUrl += '&api_key=' + self.options.publicKey; 
        }

        req.open('POST', reqUrl, false);

        if (auth_header) {
            req.setRequestHeader('X_SENTRY_AUTH', auth_header);
        }
        req.setRequestHeader('Content-type', 'application/json');
        req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        req.send(message);
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
