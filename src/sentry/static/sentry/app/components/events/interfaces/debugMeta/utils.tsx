type Status =
  | 'found'
  | 'unused'
  | 'missing'
  | 'malformed'
  | 'timeout'
  | 'fetching_failed'
  | 'other'
  | null
  | undefined;

function getStatusWeight(status: Status) {
  switch (status) {
    case null:
    case undefined:
    case 'unused':
      return 0;
    case 'found':
      return 1;
    default:
      return 2;
  }
}

function combineStatus(debugStatus: Status, unwindStatus: Status): Status {
  const debugWeight = getStatusWeight(debugStatus);
  const unwindWeight = getStatusWeight(unwindStatus);

  const combined = debugWeight >= unwindWeight ? debugStatus : unwindStatus;
  return combined || 'unused';
}

function getFileName(path: string) {
  const directorySeparator = /^([a-z]:\\|\\\\)/i.test(path) ? '\\' : '/';
  return path.split(directorySeparator).pop();
}

export {getFileName, combineStatus};
