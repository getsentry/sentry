import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';

export enum Mode {
  SAMPLES = 'samples',
  AGGREGATE = 'aggregate',
}

export function defaultMode(): Mode {
  return Mode.SAMPLES;
}

export function getModeFromLocation(location: Location, key: string): Mode {
  const rawMode = decodeScalar(location.query?.[key]);
  if (rawMode === Mode.AGGREGATE) {
    return Mode.AGGREGATE;
  }
  return defaultMode();
}
