import rawStacktraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import type {Event} from 'sentry/types/event';

type GetStacktraceBodyArgs = {
  /** The Sentry event containing stack trace data. */
  event: Event;
  /** Whether the similarity embeddings feature is enabled. */
  hasSimilarityEmbeddingsFeature?: boolean;
  /** Whether to include source code context in stack trace frames for JavaScript. */
  includeJSContext?: boolean;
  /** Whether to include location (e.g. line number, column number) in stack trace frames. */
  includeLocation?: boolean;
  /** Whether to display the frames from newest to oldest. */
  newestFirst?: boolean;
  // If true, the generated stack trace will be in the default format for the platform.
  // If false, the stack trace will be structured according to newestFirst.
  rawTrace?: boolean;
};

/**
 * Extracts and formats stack trace content from a Sentry event for display.
 *
 * @returns Array of formatted strings each representing a stack trace, one per exception found in the event.
 */
export default function getStacktraceBody({
  event,
  hasSimilarityEmbeddingsFeature = false,
  includeLocation = true,
  rawTrace = true,
  newestFirst = true,
  includeJSContext = false,
}: GetStacktraceBodyArgs) {
  if (!event?.entries) {
    return [];
  }

  // TODO(billyvg): This only accounts for the first exception, will need navigation to be able to
  // diff multiple exceptions
  //
  // See: https://github.com/getsentry/sentry/issues/6055
  let exc = event.entries.find(({type}) => type === 'exception');

  if (!exc) {
    // Look for threads if not an exception
    exc = event.entries.find(({type}) => type === 'threads');
    if (!exc) {
      // Look for a message if not an exception
      const msg = event.entries.find(({type}) => type === 'message');
      if (!msg) {
        return [];
      }
      return msg?.data?.formatted && [msg.data.formatted];
    }
  }

  if (!exc.data) {
    return [];
  }

  // TODO(ts): This should be verified when EntryData has the correct type
  return exc.data.values
    .filter((value: any) => !!value.stacktrace)
    .map((value: any) =>
      rawStacktraceContent({
        data: value.stacktrace,
        platform: event.platform,
        exception: value,
        hasSimilarityEmbeddingsFeature,
        includeLocation,
        rawTrace,
        newestFirst,
        includeJSContext,
      })
    )
    .reduce((acc: any, value: any) => acc.concat(value), []);
}
