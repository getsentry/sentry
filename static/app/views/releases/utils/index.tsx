import {Location} from 'history';
import pick from 'lodash/pick';
import round from 'lodash/round';
import moment from 'moment';

import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {PAGE_URL_PARAM, URL_PARAM} from 'app/constants/globalSelectionHeader';
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

export type ReleaseBounds = {releaseStart?: string | null; releaseEnd?: string | null};

export function getReleaseBounds(release?: Release): ReleaseBounds {
  const {firstEvent, lastEvent, currentProjectMeta} = release || {};
  const {sessionsLowerBound, sessionsUpperBound} = currentProjectMeta || {};

  return {
    releaseStart: moment(sessionsLowerBound).isBefore(firstEvent)
      ? sessionsLowerBound
      : firstEvent,
    releaseEnd: moment(sessionsUpperBound).isAfter(lastEvent)
      ? sessionsUpperBound
      : lastEvent,
  };
}

type GetReleaseParams = {
  location: Location;
  releaseBounds: ReleaseBounds;
  defaultStatsPeriod: string;
  allowEmptyPeriod: boolean;
};

// these option are here only temporarily while we still support older and newer release details page
export function getReleaseParams({
  location,
  releaseBounds,
  defaultStatsPeriod,
  allowEmptyPeriod,
}: GetReleaseParams) {
  const params = getParams(
    pick(location.query, [
      ...Object.values(URL_PARAM),
      ...Object.values(PAGE_URL_PARAM),
      'cursor',
    ]),
    {
      allowAbsolutePageDatetime: true,
      defaultStatsPeriod,
      allowEmptyPeriod,
    }
  );
  if (
    !Object.keys(params).some(param =>
      [URL_PARAM.START, URL_PARAM.END, URL_PARAM.UTC, URL_PARAM.PERIOD].includes(param)
    )
  ) {
    params[URL_PARAM.START] = releaseBounds.releaseStart;
    params[URL_PARAM.END] = releaseBounds.releaseEnd;
  }

  return params;
}
