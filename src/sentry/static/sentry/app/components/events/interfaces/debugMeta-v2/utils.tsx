import {ImageStatus} from 'app/types/debugImage';

export function getStatusWeight(status?: ImageStatus | null) {
  switch (status) {
    case null:
    case undefined:
    case ImageStatus.UNUSED:
      return 0;
    case ImageStatus.FOUND:
      return 1;
    default:
      return 2;
  }
}

export function combineStatus(
  debugStatus?: ImageStatus | null,
  unwindStatus?: ImageStatus | null
): ImageStatus {
  const debugWeight = getStatusWeight(debugStatus);
  const unwindWeight = getStatusWeight(unwindStatus);

  const combined = debugWeight >= unwindWeight ? debugStatus : unwindStatus;
  return combined || ImageStatus.UNUSED;
}

export function getFileName(path: string) {
  const directorySeparator = /^([a-z]:\\|\\\\)/i.test(path) ? '\\' : '/';
  return path.split(directorySeparator).pop();
}

export function normalizeId(id?: string) {
  return id?.trim().toLowerCase().replace(/[- ]/g, '') ?? '';
}
