import rawStacktraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import type {Event} from 'sentry/types/event';

export default function getStacktraceBody(
  event: Event,
  hasSimilarityEmbeddingsFeature: boolean = false
) {
  if (!event || !event.entries) {
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
    .filter(value => !!value.stacktrace)
    .map(value =>
      rawStacktraceContent(
        value.stacktrace,
        event.platform,
        value,
        hasSimilarityEmbeddingsFeature
      )
    )
    .reduce((acc, value) => acc.concat(value), []);
}
