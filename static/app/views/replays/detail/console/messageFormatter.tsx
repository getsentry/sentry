// webpack fallback handles this
// eslint-disable-next-line
import {format} from 'util';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import isObject from 'lodash/isObject';
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

  // There is a special case where `console.error()` is called with an Error object.
  // The SDK uses the Error's `message` property as the breadcrumb message, but we lose the Error type,
  // resulting in an empty object in the breadcrumb arguments. In this case, we
  // only want to use `breadcrumb.message`.
  if (
    breadcrumb.message &&
    breadcrumb.data?.arguments.length === 1 &&
    isObject(breadcrumb.data.arguments[0]) &&
    objectIsEmpty(breadcrumb.data.arguments[0])
  ) {
    logMessage = breadcrumb.message;
  } else {
    logMessage = format(...breadcrumb.data.arguments);
  }

  // TODO(replays): Add better support for AnnotatedText (e.g. we use message
  // args from breadcrumb.data.arguments and not breadcrumb.message directly)
  return <AnnotatedText meta={getMeta(breadcrumb, 'message')} value={logMessage} />;
}

export default MessageFormatter;
