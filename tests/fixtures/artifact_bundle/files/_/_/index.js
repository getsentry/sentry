/* global exports */
Object.defineProperty(exports, '__esModule', {value: true});
const tslib_1 = require('tslib');
const hub_1 = require('@sentry/hub');
/**
 * This calls a function on the current hub.
 * @param method function to call on hub.
 * @param args to pass to function.
 */
function callOnHub(method) {
  const args = [];
  for (let _i = 1; _i < arguments.length; _i++) {
    args[_i - 1] = arguments[_i];
  }
  const hub = hub_1.getCurrentHub();
  if (hub && hub[method]) {
    // tslint:disable-next-line:no-unsafe-any
    return hub[method].apply(hub, tslib_1.__spread(args));
  }
  throw new Error(
    'No hub defined or ' + method + ' was not found on the hub, please open a bug report.'
  );
}
/**
 * Captures an exception event and sends it to Sentry.
 *
 * @param exception An exception-like object.
 * @returns The generated eventId.
 */
function captureException(exception) {
  let syntheticException;
  try {
    throw new Error('Sentry syntheticException');
  } catch (error) {
    syntheticException = error;
  }
  return callOnHub('captureException', exception, {
    originalException: exception,
    syntheticException,
  });
}
exports.captureException = captureException;
/**
 * Captures a message event and sends it to Sentry.
 *
 * @param message The message to send to Sentry.
 * @param level Define the level of the message.
 * @returns The generated eventId.
 */
function captureMessage(message, level) {
  let syntheticException;
  try {
    throw new Error(message);
  } catch (exception) {
    syntheticException = exception;
  }
  return callOnHub('captureMessage', message, level, {
    originalException: message,
    syntheticException,
  });
}
exports.captureMessage = captureMessage;
/**
 * Captures a manually created event and sends it to Sentry.
 *
 * @param event The event to send to Sentry.
 * @returns The generated eventId.
 */
function captureEvent(event) {
  return callOnHub('captureEvent', event);
}
exports.captureEvent = captureEvent;
/**
 * Records a new breadcrumb which will be attached to future events.
 *
 * Breadcrumbs will be added to subsequent events to provide more context on
 * user's actions prior to an error or crash.
 *
 * @param breadcrumb The breadcrumb to record.
 */
function addBreadcrumb(breadcrumb) {
  callOnHub('addBreadcrumb', breadcrumb);
}
exports.addBreadcrumb = addBreadcrumb;
/**
 * Callback to set context information onto the scope.
 * @param callback Callback function that receives Scope.
 */
function configureScope(callback) {
  callOnHub('configureScope', callback);
}
exports.configureScope = configureScope;
/**
 * Creates a new scope with and executes the given operation within.
 * The scope is automatically removed once the operation
 * finishes or throws.
 *
 * This is essentially a convenience function for:
 *
 *     pushScope();
 *     callback();
 *     popScope();
 *
 * @param callback that will be enclosed into push/popScope.
 */
function withScope(callback) {
  callOnHub('withScope', callback);
}
exports.withScope = withScope;
/**
 * Calls a function on the latest client. Use this with caution, it's meant as
 * in "internal" helper so we don't need to expose every possible function in
 * the shim. It is not guaranteed that the client actually implements the
 * function.
 *
 * @param method The method to call on the client/client.
 * @param args Arguments to pass to the client/fontend.
 */
function _callOnClient(method) {
  const args = [];
  for (let _i = 1; _i < arguments.length; _i++) {
    args[_i - 1] = arguments[_i];
  }
  callOnHub.apply(void 0, tslib_1.__spread(['_invokeClient', method], args));
}
exports._callOnClient = _callOnClient;
//# sourceMappingURL=index.js.map
