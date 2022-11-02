import isObject from 'lodash/isObject';
import {sprintf, vsprintf} from 'sprintf-js';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {objectIsEmpty} from 'sentry/utils';

interface Props {
  breadcrumb: Extract<Crumb, BreadcrumbTypeDefault>;
}

/**
 * Attempt to emulate the browser console as much as possible
 */
function MessageFormatter({breadcrumb}: Props) {
  let logMessage = '';

  if (!breadcrumb.data?.arguments) {
    // There is a possibility that we don't have arguments as we could be receiving an exception type breadcrumb.
    // In these cases we just need the message prop.

    // There are cases in which our prop message is an array, we want to force it to become a string
    logMessage = breadcrumb.message?.toString() || '';
    return <AnnotatedText meta={getMeta(breadcrumb, 'message')} value={logMessage} />;
  }

  // Browser's console formatter only works on the first arg
  const [message, ...args] = breadcrumb.data?.arguments;

  const isMessageString = typeof message === 'string';

  const placeholders = isMessageString
    ? sprintf.parse(message).filter(parsed => Array.isArray(parsed))
    : [];

  // Placeholders can only occur in the first argument and only if it is a string.
  // We can skip the below code and avoid using `sprintf` if there are no placeholders.
  if (placeholders.length) {
    // TODO `%c` is console specific, it applies colors to messages
    // for now we are stripping it as this is potentially risky to implement due to xss
    const consoleColorPlaceholderIndexes = placeholders
      .filter(([placeholder]) => placeholder === '%c')
      .map((_, i) => i);

    // Retrieve message formatting args
    const messageArgs = args.slice(0, placeholders.length);

    // Filter out args that were for %c
    for (const colorIndex of consoleColorPlaceholderIndexes) {
      messageArgs.splice(colorIndex, 1);
    }

    // Attempt to stringify the rest of the args
    const restArgs = args.slice(placeholders.length).map(renderString);

    const formattedMessage = isMessageString
      ? vsprintf(message.replaceAll('%c', ''), messageArgs)
      : renderString(message);

    logMessage = [formattedMessage, ...restArgs].join(' ').trim();
  } else if (
    breadcrumb.data?.arguments.length === 1 &&
    isObject(message) &&
    objectIsEmpty(message)
  ) {
    // There is a special case where `console.error()` is called with an Error object.
    // The SDK uses the Error's `message` property as the breadcrumb message, but we lose the Error type,
    // resulting in an empty object in the breadcrumb arguments. In this case, we
    // only want to use `breadcrumb.message`.
    logMessage = breadcrumb.message || JSON.stringify(message);
  } else {
    // If the string `[object Object]` is found in message, it means the SDK attempted to stringify an object,
    // but the actual object should be captured in the arguments.
    //
    // Likewise if arrays are found e.g. [test,test] the SDK will serialize it to 'test, test'.
    //
    // In those cases, we'll want to use our pretty print in every argument that was passed to the logger instead of using
    // the SDK's serialization.
    const argValues = breadcrumb.data?.arguments.map(renderString);

    logMessage = argValues.join(' ').trim();
  }

  // TODO(replays): Add better support for AnnotatedText (e.g. we use message
  // args from breadcrumb.data.arguments and not breadcrumb.message directly)
  return <AnnotatedText meta={getMeta(breadcrumb, 'message')} value={logMessage} />;
}

/**
 * Attempt to stringify
 */
function renderString(arg: string | number | boolean | object) {
  if (typeof arg !== 'object') {
    return arg;
  }

  try {
    return JSON.stringify(arg);
  } catch {
    return arg.toString();
  }
}

export default MessageFormatter;
