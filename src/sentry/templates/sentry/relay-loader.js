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

  // Create a `script` tag with provided `url` and attach it just before first already existing `script` tag
  // This will fetch our SDK Loader and do all the magic

  // https://www.html5rocks.com/en/tutorials/speed/script-loading/
  // Scripts that are dynamically created and added to the document are async by default,
  // they don’t block rendering and execute as soon as they download, meaning they could
  // come out in the wrong order. Because of that we don't need async=1 as GA does.
  // it was probably(?) a legacy behavior that they left to not modify few years old snippet
  _newScriptTag = _document.createElement(_script);
  _currentScriptTag = _document.getElementsByTagName(_script)[0];

  _currentScriptTag.parentNode.insertBefore(_newScriptTag, _currentScriptTag);
  let sentryScript = document.querySelector('script[data-public-key]');
  if (!sentryScript) {
    console.error('No script found with data-public-key attribute');
    return;
  }
  let a = document.createElement('a');
  a.href = sentryScript.getAttribute('src');
  let publicKey = sentryScript.getAttribute('data-public-key');

  _newScriptTag.src =
    a.protocol +
    '//' +
    a.host +
    (a.port ? ':' + a.port : '') +
    '/cdn/' +
    publicKey +
    '/sdk-loader.js';
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
