import type {Location} from 'history';

import type {PlatformKey} from 'sentry/types/project';

export function didProjectOrEnvironmentChange(location1: Location, location2: Location) {
  return (
    location1.query.environment !== location2.query.environment ||
    location1.query.project !== location2.query.project
  );
}

export function isPlatformANRCompatible(platform?: PlatformKey) {
  return platform === 'javascript-electron' || platform === 'android';
}
