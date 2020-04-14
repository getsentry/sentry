import round from 'lodash/round';

import localStorage from 'app/utils/localStorage';
import ConfigStore from 'app/stores/configStore';
import OrganizationStore from 'app/stores/organizationStore';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Client} from 'app/api';

const RELEASES_VERSION_KEY = 'releases:version';

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
  location.reload();
};

export const wantsLegacyReleases = () => {
  const version = localStorage.getItem(RELEASES_VERSION_KEY);

  return version === '1';
};

export const decideReleasesVersion = async hasNewReleases => {
  const api = new Client();
  const {organization} = OrganizationStore.get();

  if (wantsLegacyReleases()) {
    return hasNewReleases(false);
  }

  if (organization) {
    return hasNewReleases(organization.features.includes('releases-v2'));
  }

  try {
    const currentOrgSlug = location.pathname.split('/')[2];
    const fetchedOrg = await api.requestPromise(`/organizations/${currentOrgSlug}/`);

    return hasNewReleases(fetchedOrg.features.includes('releases-v2'));
  } catch {
    return hasNewReleases(false);
  }
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
