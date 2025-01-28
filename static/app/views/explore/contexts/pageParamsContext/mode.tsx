import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';

export enum Mode {
  SAMPLES = 'samples',
  AGGREGATE = 'aggregate',
}

export function defaultMode(): Mode {
  return Mode.SAMPLES;
}

export function getModeFromLocation(location: Location): Mode {
  const rawMode = decodeScalar(location.query.mode);
  if (rawMode === 'aggregate') {
    return Mode.AGGREGATE;
  }
  return defaultMode();
}

export function updateLocationWithMode(
  location: Location,
  mode: Mode | null | undefined
) {
  if (defined(mode)) {
    location.query.mode = mode;
  } else if (mode === null) {
    delete location.query.mode;
  }
}
