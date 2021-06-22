import round from 'lodash/round';

import {tn} from 'app/locale';
import {Release, ReleaseStatus} from 'app/types';
import {QueryResults} from 'app/utils/tokenizeSearch';
import {IssueSortOptions} from 'app/views/issueList/utils';

import {DisplayOption} from '../list/utils';

export const CRASH_FREE_DECIMAL_THRESHOLD = 95;

export const roundDuration = (seconds: number) => {
  return round(seconds, seconds > 60 ? 0 : 3);
};

export const getCrashFreePercent = (
  percent: number,
  decimalThreshold = CRASH_FREE_DECIMAL_THRESHOLD,
  decimalPlaces = 3
): number => {
  return round(percent, percent > decimalThreshold ? decimalPlaces : 0);
};

export const displayCrashFreePercent = (
  percent: number,
  decimalThreshold = CRASH_FREE_DECIMAL_THRESHOLD,
  decimalPlaces = 3
): string => {
  if (isNaN(percent)) {
    return '\u2015';
  }

  if (percent < 1 && percent > 0) {
    return `<1\u0025`;
  }

  const rounded = getCrashFreePercent(
    percent,
    decimalThreshold,
    decimalPlaces
  ).toLocaleString();

  return `${rounded}\u0025`;
};

export const getReleaseNewIssuesUrl = (
  orgSlug: string,
  projectId: string | number | null,
  version: string
) => {
  return {
    pathname: `/organizations/${orgSlug}/issues/`,
    query: {
      project: projectId,
      // we are resetting time selector because releases' new issues count doesn't take time selector into account
      statsPeriod: undefined,
      start: undefined,
      end: undefined,
      query: new QueryResults([`firstRelease:${version}`]).formatString(),
      sort: IssueSortOptions.FREQ,
    },
  };
};

export const getReleaseUnhandledIssuesUrl = (
  orgSlug: string,
  projectId: string | number | null,
  version: string
) => {
  return {
    pathname: `/organizations/${orgSlug}/issues/`,
    query: {
      project: projectId,
      query: new QueryResults([
        `release:${version}`,
        'error.unhandled:true',
      ]).formatString(),
      sort: IssueSortOptions.FREQ,
    },
  };
};

export const isReleaseArchived = (release: Release) =>
  release.status === ReleaseStatus.Archived;

export function releaseDisplayLabel(displayOption: DisplayOption, count?: number | null) {
  if (displayOption === DisplayOption.USERS) {
    return tn('user', 'users', count);
  }

  return tn('session', 'sessions', count);
}
