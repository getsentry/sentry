import rawStacktraceContent from 'app/components/events/interfaces/rawStacktraceContent';

export default function getException(event) {
  if (!event || !event.entries) {
    return [];
  }

  // TODO(billyvg): This only accounts for the first exception, will need navigation to be able to
  // diff multiple exceptions
  //
  // See: https://github.com/getsentry/sentry/issues/6055
  const exc = event.entries.find(({type}) => type === 'exception');

  if (!exc) {
    // Look for a message if not an exception
    const msg = event.entries.find(({type}) => type === 'message');
    if (!msg) {
      return [];
    }

    return msg.data && msg.data.message && [msg.data.message];
  }

  if (!exc.data) {
    return [];
  }

  return exc.data.values
    .filter(value => !!value.stacktrace)
    .map(value => rawStacktraceContent(value.stacktrace, event.platform, value))
    .reduce((acc, value) => {
      return acc.concat(value);
    }, []);
}
