import {Location} from 'history';

import {decodeInteger} from 'sentry/utils/queryString';

export const ZOOM_START = 'startDuration';
export const ZOOM_END = 'endDuration';

export function decodeHistogramZoom(location: Location) {
  let min: number | undefined = undefined;
  let max: number | undefined = undefined;

  if (ZOOM_START in location.query) {
    min = decodeInteger(location.query[ZOOM_START], 0);
  }

  if (ZOOM_END in location.query) {
    const decodedMax = decodeInteger(location.query[ZOOM_END]);
    if (typeof decodedMax === 'number') {
      max = decodedMax;
    }
  }

  return {min, max};
}
