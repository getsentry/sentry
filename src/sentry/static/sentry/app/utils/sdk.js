let _addBreadcrumb = function() {};
let _captureException = function() {};
let _captureMessage = function() {};
let _showReportDialog = function() {};
let _lastEventId = function() {};

document.addEventListener('ravenLoaded', function() {
  _addBreadcrumb = window.Raven.captureBreadcrumb.bind(window.Raven);
  _captureException = window.Raven.captureBreadcrumb.bind(window.Raven);
  _captureMessage = window.Raven.captureMessage.bind(window.Raven);
  _showReportDialog = window.Raven.showReportDialog.bind(window.Raven);
  _lastEventId = window.Raven.lastEventId.bind(window.Raven);
});

function setContextInScope(context) {
  window.Sentry.configureScope(scope => {
    if (context.user) {
      scope.setUser(context.user);
    }
    if (context.tags) {
      Object.keys(context.tags).forEach(key => {
        scope.setTag(key, context.tags[key]);
      });
    }
    if (context.extra) {
      Object.keys(context.extra).forEach(key => {
        scope.setExtra(key, context.extra[key]);
      });
    }
  });
}

document.addEventListener('sentryLoaded', function() {
  _addBreadcrumb = window.Sentry.addBreadcrumb;
  _captureMessage = function() {
    window.Sentry.getDefaultHub().pushScope();
    if (arguments[1]) {
      setContextInScope(arguments[1]);
    }
    if (arguments[0]) {
      window.Sentry.captureMessage(arguments[0]);
    }
    window.Sentry.getDefaultHub().popScope();
  };
  _captureException = function() {
    window.Sentry.getDefaultHub().pushScope();
    if (arguments[1]) {
      setContextInScope(arguments[1]);
    }
    if (arguments[0]) {
      window.Sentry.captureException(arguments[0]);
    }
    window.Sentry.getDefaultHub().popScope();
  };
  _showReportDialog = function() {
    // TODO: eventually implement this
    window.Sentry.captureMessage('Would have shown report dialog');
  };
  _lastEventId = function() {
    // TODO: eventually implement this
    window.Sentry.lastEventId('Would have called lastEventId()');
  };
});

export function captureBreadcrumb() {
  return _addBreadcrumb.apply(null, arguments);
}
export function addBreadcrumb() {
  return _addBreadcrumb.apply(null, arguments);
}
export function captureMessage() {
  return _captureMessage.apply(null, arguments);
}
export function captureException() {
  return _captureException.apply(null, arguments);
}
export function showReportDialog() {
  return _showReportDialog.apply(null, arguments);
}
export function lastEventId() {
  return _lastEventId.apply(null, arguments);
}
