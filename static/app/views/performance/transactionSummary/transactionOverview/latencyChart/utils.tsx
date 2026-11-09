import type {Location} from 'history';
import {createParser, parseAsInteger} from 'nuqs';

import {loadQueryParamsFromLocation} from 'sentry/views/explore/queryParams/parsers';

export const ZOOM_START = 'startDuration';
export const ZOOM_END = 'endDuration';

const histogramZoomParsers = {
  // A present but unparseable start still zooms from 0.
  [ZOOM_START]: createParser({
    parse: value => parseAsInteger.parse(value) ?? 0,
    serialize: String,
  }),
  [ZOOM_END]: parseAsInteger,
};

export function decodeHistogramZoom(location: Location) {
  const zoom = loadQueryParamsFromLocation(histogramZoomParsers, location);

  return {
    min: zoom[ZOOM_START] ?? undefined,
    max: zoom[ZOOM_END] ?? undefined,
  };
}
