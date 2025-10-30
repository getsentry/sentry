import type {Location} from 'history';

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
