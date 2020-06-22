import round from 'lodash/round';

import localStorage from 'app/utils/localStorage';
import ConfigStore from 'app/stores/configStore';
import OrganizationStore from 'app/stores/organizationStore';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Client} from 'app/api';
import {stringifyQueryObject} from 'app/utils/tokenizeSearch';

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

  // in case there is no organization in the store yet, we fetch it
  // this function is being called from the routes file where we do not have access to much stuff at that point
  // we will be removing this logic once we go GA with releases v2 in a few weeks
  try {
    const currentOrgSlug = location.pathname.split('/')[2];
    const fetchedOrg = await api.requestPromise(`/organizations/${currentOrgSlug}/`, {
      query: {detailed: 0},
    });

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
  if (isNaN(percent)) {
    return '\u2015';
  }

  if (percent < 1 && percent > 0) {
    return `<1%`;
  }

  const rounded = getCrashFreePercent(percent, decimalThreshold, decimalPlaces);

  return `${rounded}%`;
};

export const convertAdoptionToProgress = (
  percent: number,
  numberOfProgressUnits = 10
): number => Math.ceil((percent * numberOfProgressUnits) / 100);

export const getReleaseNewIssuesUrl = (
  orgSlug: string,
  projectId: string | number | null,
  version: string
) => {
  return {
    pathname: `/organizations/${orgSlug}/issues/`,
    query: {
      project: projectId,
      query: stringifyQueryObject({
        query: [],
        firstRelease: [version],
      }),
    },
  };
};
