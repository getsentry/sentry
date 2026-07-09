/**
 * The file is extracted from `@sentry/javascript/packages/core/src/integrations/globalhandlers.ts`
 */

type Primitive = number | string | boolean | bigint | symbol | null | undefined;

type ParameterizedString = string & {
  __sentry_template_string__?: string;
  __sentry_template_values__?: unknown[];
};

/**
 * Checks whether given string is parameterized
 * {@link isParameterizedString}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isParameterizedString(wat: unknown): wat is ParameterizedString {
  return (
    typeof wat === 'object' &&
    wat !== null &&
    '__sentry_template_string__' in wat &&
    '__sentry_template_values__' in wat
  );
}

/**
 * Checks whether given value is a primitive (undefined, null, number, boolean, string, bigint, symbol)
 * {@link isPrimitive}.
 *
 * @param wat A value to be checked.
 * @returns A boolean representing the result.
 */
function isPrimitive(wat: unknown): wat is Primitive {
  return (
    wat === null ||
    isParameterizedString(wat) ||
    (typeof wat !== 'object' && typeof wat !== 'function')
  );
}

export function getUnhandledRejectionError(error: unknown): unknown {
  if (isPrimitive(error)) {
    return error;
  }

  // dig the object of the rejection out of known event types
  try {
    type ErrorWithReason = {reason: unknown};
    // PromiseRejectionEvents store the object of the rejection under 'reason'
    // see https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent
    if ('reason' in (error as ErrorWithReason)) {
      return (error as ErrorWithReason).reason;
    }

    type CustomEventWithDetail = {detail: {reason: unknown}};
    // something, somewhere, (likely a browser extension) effectively casts PromiseRejectionEvents
    // to CustomEvents, moving the `promise` and `reason` attributes of the PRE into
    // the CustomEvent's `detail` attribute, since they're not part of CustomEvent's spec
    // see https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent and
    // https://github.com/getsentry/sentry-javascript/issues/2380
    if (
      'detail' in (error as CustomEventWithDetail) &&
      'reason' in (error as CustomEventWithDetail).detail
    ) {
      return (error as CustomEventWithDetail).detail.reason;
    }
  } catch {} // eslint-disable-line no-empty

  return error;
}
