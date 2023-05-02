declare const __LOADER__PUBLIC_KEY__: any;
declare const __LOADER_SDK_URL__: any;
declare const __LOADER__CONFIG__: any;
declare const __LOADER__IS_LAZY__: any;

(function sentryLoader(
  _window,
  _document,
  _errorEvent,
  _unhandledrejectionEvent,
  _namespace,
  _publicKey,
  _sdkBundleUrl,
  _config,
  _lazy
) {
  let lazy = _lazy;
  let forceLoad = false;

  for (let i = 0; i < document.scripts.length; i++) {
    if (document.scripts[i].src.indexOf(_publicKey) > -1) {
      // If lazy was set to true above, we need to check if the user has set data-lazy="no"
      // to confirm that we should lazy load the CDN bundle
      if (lazy && document.scripts[i].getAttribute('data-lazy') === 'no') {
        lazy = false;
      }
      break;
    }
  }

  let injected = false;
  const onLoadCallbacks: (() => void)[] = [];

  // Create a namespace and attach function that will store captured exception
  // Because functions are also objects, we can attach the queue itself straight to it and save some bytes
  const queue = function (content) {
    // content.e = error
    // content.p = promise rejection
    // content.f = function call the Sentry
    if (
      ('e' in content ||
        'p' in content ||
        (content.f && content.f.indexOf('capture') > -1) ||
        (content.f && content.f.indexOf('showReportDialog') > -1)) &&
      lazy
    ) {
      // We only want to lazy inject/load the sdk bundle if
      // an error or promise rejection occured
      // OR someone called `capture...` on the SDK
      injectSdk(onLoadCallbacks);
    }
    queue.data.push(content);
  };
  queue.data = [];

  function onError() {
    // Use keys as "data type" to save some characters"
    queue({
      e: [].slice.call(arguments),
    });
  }

  function onUnhandledRejection(e) {
    queue({
      p:
        'reason' in e
          ? e.reason
          : 'detail' in e && 'reason' in e.detail
          ? e.detail.reason
          : e,
    });
  }

  function injectSdk(callbacks) {
    if (injected) {
      return;
    }
    injected = true;

    // Create a `script` tag with provided SDK `url` and attach it just before the first, already existing `script` tag
    // Scripts that are dynamically created and added to the document are async by default,
    // they don't block rendering and execute as soon as they download, meaning they could
    // come out in the wrong order. Because of that we don't need async=1 as GA does.
    // it was probably(?) a legacy behavior that they left to not modify few years old snippet
    // https://www.html5rocks.com/en/tutorials/speed/script-loading/
    const _currentScriptTag = _document.scripts[0];
    const _newScriptTag = _document.createElement('script') as HTMLScriptElement;
    _newScriptTag.src = _sdkBundleUrl;
    _newScriptTag.crossOrigin = 'anonymous';

    // Once our SDK is loaded
    _newScriptTag.addEventListener('load', function () {
      try {
        _window.removeEventListener(_errorEvent, onError);
        _window.removeEventListener(_unhandledrejectionEvent, onUnhandledRejection);

        // Add loader as SDK source
        _window.SENTRY_SDK_SOURCE = 'loader';

        const SDK = _window[_namespace];

        const oldInit = SDK.init;

        // Configure it using provided DSN and config object
        SDK.init = function (options) {
          const target = _config;
          for (const key in options) {
            if (Object.prototype.hasOwnProperty.call(options, key)) {
              target[key] = options[key];
            }
          }

          setupDefaultIntegrations(target, SDK);
          oldInit(target);
        };

        sdkLoaded(callbacks, SDK);
      } catch (o_O) {
        console.error(o_O);
      }
    });

    _currentScriptTag.parentNode!.insertBefore(_newScriptTag, _currentScriptTag);
  }

  // We want to ensure to only add default integrations if they haven't been added by the user.
  function setupDefaultIntegrations(config: any, SDK: any) {
    const integrations: {name: string}[] = config.integrations || [];

    // integrations can be a function, in which case we will not add any defaults
    if (!Array.isArray(integrations)) {
      return;
    }

    const integrationNames = integrations.map(integration => integration.name);

    // Add necessary integrations based on config
    if (config.tracesSampleRate && integrationNames.indexOf('BrowserTracing') === -1) {
      integrations.push(new SDK.BrowserTracing());
    }

    if (
      (config.replaysSessionSampleRate || config.replaysOnErrorSampleRate) &&
      integrationNames.indexOf('Replay') === -1
    ) {
      integrations.push(new SDK.Replay());
    }

    config.integrations = integrations;
  }

  function sdkIsLoaded() {
    const __sentry = _window.__SENTRY__;
    // If there is a global __SENTRY__ that means that in any of the callbacks init() was already invoked
    return !!(
      !(typeof __sentry === 'undefined') &&
      __sentry.hub &&
      __sentry.hub.getClient()
    );
  }

  function sdkLoaded(callbacks, SDK) {
    try {
      // We have to make sure to call all callbacks first
      for (let i = 0; i < callbacks.length; i++) {
        if (typeof callbacks[i] === 'function') {
          callbacks[i]();
        }
      }

      const data = queue.data;

      let initAlreadyCalled = sdkIsLoaded();

      // Call init first, if provided
      data.sort(a => (a.f === 'init' ? -1 : 0));

      // We want to replay all calls to Sentry and also make sure that `init` is called if it wasn't already
      // We replay all calls to `Sentry.*` now
      let calledSentry = false;
      for (let i = 0; i < data.length; i++) {
        if (data[i].f) {
          calledSentry = true;
          const call = data[i];
          if (initAlreadyCalled === false && call.f !== 'init') {
            // First call always has to be init, this is a conveniece for the user so call to init is optional
            SDK.init();
          }
          initAlreadyCalled = true;
          SDK[call.f].apply(SDK, call.a);
        }
      }
      if (initAlreadyCalled === false && calledSentry === false) {
        // Sentry has never been called but we need Sentry.init() so call it
        SDK.init();
      }

      // Because we installed the SDK, at this point we have an access to TraceKit's handler,
      // which can take care of browser differences (eg. missing exception argument in onerror)
      const tracekitErrorHandler = _window.onerror;
      const tracekitUnhandledRejectionHandler = _window.onunhandledrejection;

      // And now capture all previously caught exceptions
      for (let i = 0; i < data.length; i++) {
        if ('e' in data[i] && tracekitErrorHandler) {
          tracekitErrorHandler.apply(_window, data[i].e);
        } else if ('p' in data[i] && tracekitUnhandledRejectionHandler) {
          tracekitUnhandledRejectionHandler.apply(_window, [data[i].p]);
        }
      }
    } catch (o_O) {
      console.error(o_O);
    }
  }

  // We make sure we do not overwrite window.Sentry since there could be already integrations in there
  _window[_namespace] = _window[_namespace] || {};

  _window[_namespace].onLoad = function (callback) {
    onLoadCallbacks.push(callback);
    if (lazy && !forceLoad) {
      return;
    }
    injectSdk(onLoadCallbacks);
  };

  _window[_namespace].forceLoad = function () {
    forceLoad = true;
    if (lazy) {
      setTimeout(function () {
        injectSdk(onLoadCallbacks);
      });
    }
  };

  [
    'init',
    'addBreadcrumb',
    'captureMessage',
    'captureException',
    'captureEvent',
    'configureScope',
    'withScope',
    'showReportDialog',
  ].forEach(function (f) {
    _window[_namespace][f] = function () {
      queue({f, a: arguments});
    };
  });

  _window.addEventListener(_errorEvent, onError);
  _window.addEventListener(_unhandledrejectionEvent, onUnhandledRejection);

  if (!lazy) {
    setTimeout(function () {
      injectSdk(onLoadCallbacks);
    });
  }
})(
  window as Window &
    typeof globalThis & {SENTRY_SDK_SOURCE?: string; Sentry?: any; __SENTRY__?: any},
  document,
  'error' as const,
  'unhandledrejection' as const,
  'Sentry' as const,
  __LOADER__PUBLIC_KEY__,
  __LOADER_SDK_URL__,
  __LOADER__CONFIG__,
  __LOADER__IS_LAZY__
);
