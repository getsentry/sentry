import round from 'lodash/round';

import localStorage from 'app/utils/localStorage';
import ConfigStore from 'app/stores/configStore';
import {trackAnalyticsEvent} from 'app/utils/analytics';

const RELEASES_VERSION_KEY = 'release:version';

export const switchReleasesVersion = (version: '1' | '2', orgId: string) => {
  localStorage.setItem(RELEASES_VERSION_KEY, version);
  const user = ConfigStore.get('user');
  trackAnalyticsEvent({
    eventKey: version === '1' ? 'releases_v2.opt_out' : 'releases_v2.opt_in',
    eventName:
      version === '1' ? 'ReleasesV2: Go to releases1' : 'ReleasesV2: Go to releases2',
    organization_id: parseInt(orgId, 10),
    user_id: parseInt(user.id, 10),
  });
};

export const usesNewReleases = (): boolean => {
  const version = localStorage.getItem(RELEASES_VERSION_KEY);
  if (!version) {
    // by default, turn v2 on - if user is not allowed to do that, feature flag will catch that and set it back to 1
    localStorage.setItem(RELEASES_VERSION_KEY, '2');
  }
  if (version === '1') {
    return false;
  }

  return true;
};

export const getCrashFreePercent = (
  percent: number,
  decimalThreshold = 95,
  decimalPlaces = 3
): number => {
  return round(percent, percent > decimalThreshold ? decimalPlaces : 0);
};

export const displayCrashFreePercent = (
  percent: number,
  decimalThreshold = 95,
  decimalPlaces = 3
): string => {
  if (percent < 1 && percent > 0) {
    return `<1%`;
  }

  const rounded = getCrashFreePercent(percent, decimalThreshold, decimalPlaces);

  return `${rounded}%`;
};

export const convertAdoptionToProgress = (
  percent: number,
  numberOfProgressUnits = 5
): number => Math.ceil((percent * numberOfProgressUnits) / 100);
