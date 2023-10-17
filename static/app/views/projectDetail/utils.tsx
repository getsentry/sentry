import {Location} from 'history';

import {PlatformKey} from 'sentry/types';

export function didProjectOrEnvironmentChange(location1: Location, location2: Location) {
  return (
    location1.query.environment !== location2.query.environment ||
    location1.query.project !== location2.query.project
  );
}

export function isPlatformANRCompatible(platform?: PlatformKey) {
  return platform === 'javascript-electron' || platform === 'android';
}
