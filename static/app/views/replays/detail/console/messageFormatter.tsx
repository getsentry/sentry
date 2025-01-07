import {defined} from 'sentry/utils';
import type {BreadcrumbFrame, ConsoleFrame} from 'sentry/utils/replays/types';
import {isConsoleFrame} from 'sentry/utils/replays/types';
import Format from 'sentry/views/replays/detail/console/format';
import type {OnExpandCallback} from 'sentry/views/replays/detail/useVirtualizedInspector';

interface Props {
  frame: BreadcrumbFrame;
  onExpand: OnExpandCallback;
  expandPaths?: string[];
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
    args[0] &&
    typeof args[0] === 'object' &&
    Object.keys(args[0]).length === 0
  );
}

/**
 * Attempt to emulate the browser console as much as possible
 */
export default function MessageFormatter({frame, expandPaths, onExpand}: Props) {
  if (!isConsoleFrame(frame)) {
    return (
      <Format
        expandPaths={expandPaths}
        onExpand={onExpand}
        args={[frame.category, frame.message, frame.data].filter(defined)}
      />
    );
  }

  const args = frame.data.arguments;

  // Turn this back into an Error object so <Format> can pretty print it
  if (args && isSerializedError(frame)) {
    // Sometimes message can include stacktrace
    const splitMessage = frame.message.split('\n');
    const errorMessagePiece = splitMessage[0]!.trim();
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

    // An Error object has non enumerable attributes that we want <StructuredEventData> to print
    const fakeErrorObject = JSON.parse(
      JSON.stringify(fakeError, Object.getOwnPropertyNames(fakeError))
    );

    return (
      <Format expandPaths={expandPaths} onExpand={onExpand} args={[fakeErrorObject]} />
    );
  }

  return (
    <Format
      expandPaths={expandPaths}
      onExpand={onExpand}
      args={args ?? [frame.message]}
    />
  );
}
