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
  _loaderInitConfig,
  _lazy
) {
  let lazy = _lazy;

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

  const onLoadCallbacks: (() => void)[] = [];

  // A captured error
  type ErrorQueueItem = {e: any};
  // A captured promise rejection
  type PromiseRejectionQueueItem = {p: any};
  // A captured function call to Sentry
  type FunctionQueueItem = {a: IArguments; f: string};
  type QueueItem = ErrorQueueItem | PromiseRejectionQueueItem | FunctionQueueItem;

  function queueIsError(item: QueueItem): item is ErrorQueueItem {
    return 'e' in item;
  }

  function queueIsPromiseRejection(item: QueueItem): item is PromiseRejectionQueueItem {
    return 'p' in item;
  }

  function queueIsFunction(item: QueueItem): item is FunctionQueueItem {
    return 'f' in item;
  }

  const queue: QueueItem[] = [];

  // Create a namespace and attach function that will store captured exception
  // Because functions are also objects, we can attach the queue itself straight to it and save some bytes
  function enqueue(item: QueueItem) {
    if (
      lazy &&
      (queueIsError(item) ||
        queueIsPromiseRejection(item) ||
        (queueIsFunction(item) && item.f.indexOf('capture') > -1) ||
        (queueIsFunction(item) && item.f.indexOf('showReportDialog') > -1))
    ) {
      // We only want to lazy inject/load the sdk bundle if
      // an error or promise rejection occured
      // OR someone called `capture...` on the SDK
      injectCDNScriptTag();
    }
    queue.push(item);
  }

  function onError() {
    // Use keys as "data type" to save some characters"
    enqueue({
      e: [].slice.call(arguments),
    });
  }

  function onUnhandledRejection(p) {
    enqueue({
      p,
    });
  }

  function onSentryCDNScriptLoaded() {
    try {
      // Add loader as SDK source
      _window.SENTRY_SDK_SOURCE = 'loader';

      const SDK = _window[_namespace];

      const cdnInit = SDK.init;

      // Configure it using provided DSN and config object
      SDK.init = function (options) {
        // Remove the lazy mode error event listeners that we previously registered
        // Once we call init, we can assume that Sentry has added it's own global error listeners
        _window.removeEventListener(_errorEvent, onError);
        _window.removeEventListener(_unhandledrejectionEvent, onUnhandledRejection);

        const mergedInitOptions = _loaderInitConfig;
        for (const key in options) {
          if (Object.prototype.hasOwnProperty.call(options, key)) {
            mergedInitOptions[key] = options[key];
          }
        }

        setupDefaultIntegrations(mergedInitOptions, SDK);
        cdnInit(mergedInitOptions);
      };

      // Wait a tick to ensure that all `Sentry.onLoad()` callbacks have been registered
      setTimeout(() => setupSDK(SDK));
    } catch (o_O) {
      console.error(o_O);
    }
  }

  let injectedCDNScriptTag = false;

  /**
   * Injects script tag into the page pointing to the CDN bundle.
   */
  function injectCDNScriptTag() {
    if (injectedCDNScriptTag) {
      return;
    }
    injectedCDNScriptTag = true;

    // Create a `script` tag with provided SDK `url` and attach it just before the first, already existing `script` tag
    // Scripts that are dynamically created and added to the document are async by default,
    // they don't block rendering and execute as soon as they download, meaning they could
    // come out in the wrong order. Because of that we don't need async=1 as GA does.
    // it was probably(?) a legacy behavior that they left to not modify few years old snippet
    // https://www.html5rocks.com/en/tutorials/speed/script-loading/
    const firstScriptTagInDom = _document.scripts[0];
    const cdnScriptTag = _document.createElement('script') as HTMLScriptElement;
    cdnScriptTag.src = _sdkBundleUrl;
    cdnScriptTag.crossOrigin = 'anonymous';

    // Once our SDK is loaded
    cdnScriptTag.addEventListener('load', onSentryCDNScriptLoaded, {
      once: true,
      passive: true,
    });
    firstScriptTagInDom.parentNode!.insertBefore(cdnScriptTag, firstScriptTagInDom);
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

  function setupSDK(SDK) {
    try {
      // If defined, we call window.sentryOnLoad first
      if (typeof _window.sentryOnLoad === 'function') {
        _window.sentryOnLoad();
        // Cleanup to allow garbage collection
        _window.sentryOnLoad = undefined;
      }

      // We have to make sure to call all callbacks first
      for (let i = 0; i < onLoadCallbacks.length; i++) {
        if (typeof onLoadCallbacks[i] === 'function') {
          onLoadCallbacks[i]();
        }
      }
      // Cleanup to allow garbage collection
      onLoadCallbacks.splice(0);

      // First call all inits from the queue
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (queueIsFunction(item) && item.f === 'init') {
          SDK.init.apply(SDK, item.a);
        }
      }

      // If the SDK has not been called manually, either in an onLoad callback, or somewhere else,
      // we initialize it for the user
      if (!sdkIsLoaded()) {
        SDK.init();
      }

      // Now, we _know_ that the SDK is initialized, and can continue with the rest of the queue

      // Because we installed the SDK, at this point we can assume that the global handlers have been patched
      // which can take care of browser differences (eg. missing exception argument in onerror)
      const sentryPatchedErrorHandler = _window.onerror;
      const sentryPatchedUnhandledRejectionHandler = _window.onunhandledrejection;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];

        if (queueIsFunction(item)) {
          // We already called all init before, so just skip this
          if (item.f === 'init') {
            continue;
          }

          SDK[item.f].apply(SDK, item.a);
        } else if (queueIsError(item) && sentryPatchedErrorHandler) {
          sentryPatchedErrorHandler.apply(_window, item.e);
        } else if (
          queueIsPromiseRejection(item) &&
          sentryPatchedUnhandledRejectionHandler
        ) {
          sentryPatchedUnhandledRejectionHandler.apply(_window, [item.p]);
        }
      }
    } catch (o_O) {
      console.error(o_O);
    }
  }

  // We make sure we do not overwrite window.Sentry since there could be already integrations in there
  _window[_namespace] = _window[_namespace] || {};

  _window[_namespace].onLoad = function (callback) {
    // If the SDK was already loaded, call the callback immediately
    if (sdkIsLoaded()) {
      callback();
      return;
    }
    onLoadCallbacks.push(callback);
  };

  _window[_namespace].forceLoad = function () {
    setTimeout(function () {
      injectCDNScriptTag();
    });
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
      enqueue({f, a: arguments});
    };
  });

  _window.addEventListener(_errorEvent, onError);
  _window.addEventListener(_unhandledrejectionEvent, onUnhandledRejection);

  if (!lazy) {
    setTimeout(function () {
      injectCDNScriptTag();
    });
  }
})(
  window as Window &
    typeof globalThis & {
      SENTRY_SDK_SOURCE?: string;
      Sentry?: any;
      __SENTRY__?: any;
      sentryOnLoad?: () => void;
    },
  document,
  'error' as const,
  'unhandledrejection' as const,
  'Sentry' as const,
  __LOADER__PUBLIC_KEY__,
  __LOADER_SDK_URL__,
  __LOADER__CONFIG__,
  __LOADER__IS_LAZY__
);
