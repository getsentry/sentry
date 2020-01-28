function findThreadException(thread, event) {
  for (const entry of event.entries) {
    if (entry.type !== 'exception') {
      continue;
    }
    for (const exc of entry.data.values) {
      if (exc.threadId === thread.id) {
        return entry.data;
      }
    }
  }
  return null;
}

export default findThreadException;
