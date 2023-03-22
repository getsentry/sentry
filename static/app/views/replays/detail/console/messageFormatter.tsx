import isObject from 'lodash/isObject';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {objectIsEmpty} from 'sentry/utils';

import Format from './format';

interface Props {
  breadcrumb: Extract<Crumb, BreadcrumbTypeDefault>;
  onDimensionChange?: () => void;
}

/**
 * Attempt to emulate the browser console as much as possible
 */
function MessageFormatter({breadcrumb, onDimensionChange}: Props) {
  let args = breadcrumb.data?.arguments;

  if (!args) {
    // There is a possibility that we don't have arguments as we could be receiving an exception type breadcrumb.
    // In these cases we just need the message prop.

    // There are cases in which our prop message is an array, we want to force it to become a string
    return (
      <AnnotatedText
        meta={getMeta(breadcrumb, 'message')}
        value={breadcrumb.message?.toString() || ''}
      />
    );
  }

  // There is a special case where `console.error()` is called with an Error object.
  // The SDK uses the Error's `message` property as the breadcrumb message, but we lose the Error type,
  // resulting in an empty object in the breadcrumb arguments.
  //
  // In this special case, we re-create the error object
  const isSerializedError =
    breadcrumb.message &&
    typeof breadcrumb.message === 'string' &&
    args.length <= 2 &&
    isObject(args[0]) &&
    objectIsEmpty(args[0]);

  if (isSerializedError && breadcrumb.message) {
    // Turn this back into an Error object so <Format> can pretty print it
    const fakeError = new Error(breadcrumb.message.split('\n')[0].trim());

    try {
      fakeError.stack = args[1];
    } catch {
      // Some browsers won't allow you to write to stack property}
    }
    args = [fakeError];
  }

  return <Format onExpand={onDimensionChange} args={args} />;
}

export default MessageFormatter;
