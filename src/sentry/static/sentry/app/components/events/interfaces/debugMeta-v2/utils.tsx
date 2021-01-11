import {ImageProcessingInfo} from 'app/types/debugImage';

export function getStatusWeight(status?: ImageProcessingInfo | null) {
  switch (status) {
    case null:
    case undefined:
    case ImageProcessingInfo.UNUSED:
      return 0;
    case ImageProcessingInfo.FOUND:
      return 1;
    default:
      return 2;
  }
}

export function combineStatus(
  debugStatus?: ImageProcessingInfo | null,
  unwindStatus?: ImageProcessingInfo | null
): ImageProcessingInfo {
  const debugWeight = getStatusWeight(debugStatus);
  const unwindWeight = getStatusWeight(unwindStatus);

  const combined = debugWeight >= unwindWeight ? debugStatus : unwindStatus;
  return combined || ImageProcessingInfo.UNUSED;
}

export function getFileName(path: string) {
  const directorySeparator = /^([a-z]:\\|\\\\)/i.test(path) ? '\\' : '/';
  return path.split(directorySeparator).pop();
}

export function normalizeId(id?: string) {
  return id?.trim().toLowerCase().replace(/[- ]/g, '') ?? '';
}
