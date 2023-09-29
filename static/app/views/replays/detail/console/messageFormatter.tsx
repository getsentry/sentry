import {memo} from 'react';
import isObject from 'lodash/isObject';

import {OnExpandCallback} from 'sentry/components/objectInspector';
import {objectIsEmpty} from 'sentry/utils';
import type {BreadcrumbFrame, ConsoleFrame} from 'sentry/utils/replays/types';
import {isConsoleFrame} from 'sentry/utils/replays/types';
import Format from 'sentry/views/replays/detail/console/format';

interface Props {
  frame: BreadcrumbFrame;
  expandPaths?: string[];
  onExpand?: OnExpandCallback;
}

// There is a special case where `console.error()` is called with an Error object.
// The SDK uses the Error's `message` property as the breadcrumb message, but we lose the Error type,
// resulting in an empty object in the breadcrumb arguments.
//
// In this special case, we re-create the error object
function isSerializedError(frame: ConsoleFrame) {
  const args = frame.data.arguments;
  return (
    frame.message &&
    typeof frame.message === 'string' &&
    Array.isArray(args) &&
    args.length <= 2 &&
    isObject(args[0]) &&
    objectIsEmpty(args[0])
  );
}

/**
 * Attempt to emulate the browser console as much as possible
 */
function UnmemoizedMessageFormatter({frame, expandPaths, onExpand}: Props) {
  if (!isConsoleFrame(frame)) {
    return (
      <Format
        expandPaths={expandPaths}
        onExpand={onExpand}
        args={[frame.category, frame.data]}
      />
    );
  }

  const args = frame.data.arguments;

  // Turn this back into an Error object so <Format> can pretty print it
  if (args && isSerializedError(frame)) {
    // Sometimes message can include stacktrace
    const splitMessage = frame.message.split('\n');
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
      fakeError.stack = args.length === 2 ? (args[1] as string) : undefined;

      // Re-create the error name
      if (errorMessageSplit.length > 1) {
        fakeError.name = errorMessageSplit[0] + 'Error: ';
      }
    } catch {
      // Some browsers won't allow you to write to error properties
    }

    return <Format expandPaths={expandPaths} onExpand={onExpand} args={[fakeError]} />;
  }

  return (
    <Format
      expandPaths={expandPaths}
      onExpand={onExpand}
      args={args ?? [frame.message]}
    />
  );
}

const MessageFormatter = memo(UnmemoizedMessageFormatter);
export default MessageFormatter;
