function findThreadStacktrace(thread, event, raw) {
  if (raw && thread.rawStacktrace) {
    return thread.rawStacktrace;
  } else if (thread.stacktrace) {
    return thread.stacktrace;
  }
  const exc = findThreadException(thread, event);
  if (exc) {
    let rv = null;
    for (const singleExc of exc.values) {
      if (singleExc.threadId === thread.id) {
        rv = (raw && singleExc.rawStacktrace) || singleExc.stacktrace;
      }
    }
    return rv;
  }
  return null;
}

export default findThreadStacktrace;
