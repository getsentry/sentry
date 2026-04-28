import {Fragment} from 'react';

import {formatAddress, getImageRange} from 'sentry/components/events/interfaces/utils';
import type {Image} from 'sentry/types/debugImage';
import {ImageStatus} from 'sentry/types/debugImage';

const IMAGE_ADDR_LEN = 12;

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

export function getFileName(path?: string | null) {
  if (!path) {
    return undefined;
  }
  const directorySeparator = /^([a-z]:\\|\\\\)/i.test(path) ? '\\' : '/';
  return path.split(directorySeparator).pop();
}

export function normalizeId(id?: string) {
  return id?.trim().toLowerCase().replace(/[- ]/g, '') ?? '';
}

export function getImageAddress(image: Image) {
  const [startAddress, endAddress] = getImageRange(image);

  if (startAddress && endAddress) {
    return (
      <Fragment>
        <span>{formatAddress(startAddress, IMAGE_ADDR_LEN)}</span>
        {' \u2013 '}
        <span>{formatAddress(endAddress, IMAGE_ADDR_LEN)}</span>
      </Fragment>
    );
  }

  return undefined;
}
