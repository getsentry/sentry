import * as Sentry from '@sentry/browser';

let _addBreadcrumb = () => {};
let _captureException = () => {};
let _captureMessage = () => {};
let _showReportDialog = () => {};
let _lastEventId = () => {};

function setContextInScope(context) {
  Sentry.configureScope(scope => {
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

    if (context.fingerprint) {
      scope.setFingerprint(context.fingerprint);
    }
  });
}

Sentry.onLoad(function() {
  _addBreadcrumb = Sentry.addBreadcrumb;
  _captureMessage = (...args) => {
    Sentry.getDefaultHub().pushScope();
    if (args[1]) {
      setContextInScope(args[1]);
    }
    if (args[0]) {
      Sentry.captureMessage(args[0]);
    }
    Sentry.getDefaultHub().popScope();
  };
  _captureException = (...args) => {
    Sentry.getDefaultHub().pushScope();
    if (args[1]) {
      setContextInScope(args[1]);
    }
    if (args[0]) {
      Sentry.captureException(args[0]);
    }
    Sentry.getDefaultHub().popScope();
  };
  _showReportDialog = () => {
    Sentry.showReportDialog();
  };
  _lastEventId = () => {
    Sentry.lastEventId();
  };
});

export default {
  captureBreadcrumb: (...args) => {
    return _addBreadcrumb(...args);
  },
  addBreadcrumb: (...args) => {
    return _addBreadcrumb(...args);
  },
  captureMessage: (...args) => {
    return _captureMessage(...args);
  },
  captureException: (...args) => {
    return _captureException(...args);
  },
  showReportDialog: (...args) => {
    return _showReportDialog(...args);
  },
  lastEventId: (...args) => {
    return _lastEventId(...args);
  },
};
