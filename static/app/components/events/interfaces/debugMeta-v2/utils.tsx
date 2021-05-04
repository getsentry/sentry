import {Fragment} from 'react';

import {DebugImage} from 'app/components/events/interfaces/debugMeta/types';
import {formatAddress, getImageRange} from 'app/components/events/interfaces/utils';
import {Image, ImageStatus} from 'app/types/debugImage';
import {defined} from 'app/utils';

const IMAGE_ADDR_LEN = 12;
export const IMAGE_AND_CANDIDATE_LIST_MAX_HEIGHT = 400;

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

// TODO(ts): When replacing debugMeta with debugMetaV2, also replace {type: string} with the Image type defined in 'app/types/debugImage'
export function shouldSkipSection(
  filteredImages: Array<{type: string}>,
  images: Array<{type: string} | null>
) {
  if (!!filteredImages.length) {
    return false;
  }

  const definedImages = images.filter(image => defined(image));

  if (!definedImages.length) {
    return true;
  }

  if ((definedImages as Array<Image>).every(image => image.type === 'proguard')) {
    return true;
  }

  return false;
}

export function getImageAddress(image: Image) {
  const [startAddress, endAddress] = getImageRange(image as DebugImage);

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
