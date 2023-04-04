import {memo} from 'react';
import isObject from 'lodash/isObject';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {objectIsEmpty} from 'sentry/utils';

import Format from './format';

interface Props {
  breadcrumb: Extract<Crumb, BreadcrumbTypeDefault>;
  expandPaths?: string[];
  onDimensionChange?: (path: string, expandedState: Record<string, boolean>) => void;
}

/**
 * Attempt to emulate the browser console as much as possible
 */
const UnmemoizedMessageFormatter = ({
  breadcrumb,
  expandPaths,
  onDimensionChange,
}: Props) => {
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
    isObject(args[0]);

  // Turn this back into an Error object so <Format> can pretty print it
  if (isSerializedError && objectIsEmpty(args[0]) && breadcrumb.message) {
    // Sometimes message can include stacktrace
    const splitMessage = breadcrumb.message.split('\n');
    const errorMessagePiece = splitMessage[0].trim();
    // Error.prototype.toString() will prepend the error type meaning it will
    // not be the same as `message` property. We want message only when
    // creating a new Error instance, otherwise the type will repeat.
    const errorMessageSplit = errorMessagePiece.split('Error: ');
    // Restitch together in case there were other `Error: ` strings in the message
    const errorMessage = errorMessageSplit
      .splice(errorMessageSplit.length - 1)
      .join('Error: ');
    const fakeError = new Error(errorMessage);

    try {
      // Messages generally do not include stack trace due to SDK serialization
      fakeError.stack = args.length === 2 ? args[1] : undefined;

      // Re-create the error name
      if (errorMessageSplit.length > 1) {
        fakeError.name = errorMessageSplit[0] + 'Error: ';
      }
    } catch {
      // Some browsers won't allow you to write to error properties
    }

    args = [fakeError];
  }

  return <Format expandPaths={expandPaths} onExpand={onDimensionChange} args={args} />;
};

const MessageFormatter = memo(UnmemoizedMessageFormatter);
export default MessageFormatter;
