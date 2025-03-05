import type {Location} from 'history';
import pick from 'lodash/pick';
import round from 'lodash/round';
import moment from 'moment-timezone';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import type {TagProps} from 'sentry/components/core/badge/tag';
import ExternalLink from 'sentry/components/links/externalLink';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PAGE_URL_PARAM, URL_PARAM} from 'sentry/constants/pageFilters';
import {desktop, mobile} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';
import type {Release, SemverVersion, VersionInfo} from 'sentry/types/release';
import {ReleaseStatus} from 'sentry/types/release';
import {defined} from 'sentry/utils';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

export const CRASH_FREE_DECIMAL_THRESHOLD = 90;

export const roundDuration = (seconds: number) => {
  return round(seconds, seconds > 60 ? 0 : 3);
};

export const getCrashFreePercent = (
  percent: number,
  decimalThreshold = CRASH_FREE_DECIMAL_THRESHOLD,
  decimalPlaces = 3
): number => {
  const roundedValue = round(percent, percent > decimalThreshold ? decimalPlaces : 0);
  if (roundedValue === 100 && percent < 100) {
    return (
      Math.floor(percent * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)
    );
  }

  return roundedValue;
};

export const displayCrashFreePercent = (
  percent: number,
  decimalThreshold = CRASH_FREE_DECIMAL_THRESHOLD,
  decimalPlaces = 3,
  formatLessThanOnePercent = true
): string => {
  if (isNaN(percent)) {
    return '\u2015';
  }

  if (formatLessThanOnePercent && percent < 1 && percent > 0) {
    return `<1\u0025`;
  }

  const rounded = getCrashFreePercent(
    percent,
    decimalThreshold,
    decimalPlaces
  ).toLocaleString();

  return `${rounded}\u0025`;
};

export const getSessionStatusPercent = (percent: number, absolute = true) => {
  return round(absolute ? Math.abs(percent) : percent, 3);
};

export const displaySessionStatusPercent = (percent: number, absolute = true) => {
  return `${getSessionStatusPercent(percent, absolute).toLocaleString()}\u0025`;
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
      query: new MutableSearch([`firstRelease:${version}`]).formatString(),
      sort: IssueSortOptions.FREQ,
    },
  };
};

export const getReleaseUnhandledIssuesUrl = (
  orgSlug: string,
  projectId: string | number | null,
  version: string,
  dateTime: DateTimeObject = {}
) => {
  return {
    pathname: `/organizations/${orgSlug}/issues/`,
    query: {
      ...dateTime,
      project: projectId,
      query: new MutableSearch([
        `release:${version}`,
        'error.unhandled:true',
      ]).formatString(),
      sort: IssueSortOptions.FREQ,
    },
  };
};

export const getReleaseHandledIssuesUrl = (
  orgSlug: string,
  projectId: string | number | null,
  version: string,
  dateTime: DateTimeObject = {}
) => {
  return {
    pathname: `/organizations/${orgSlug}/issues/`,
    query: {
      ...dateTime,
      project: projectId,
      query: new MutableSearch([
        `release:${version}`,
        'error.handled:true',
      ]).formatString(),
      sort: IssueSortOptions.FREQ,
    },
  };
};

export const isReleaseArchived = (release: Release) =>
  release.status === ReleaseStatus.ARCHIVED;

export type ReleaseBounds = {
  type: 'normal' | 'clamped' | 'ancient';
  releaseEnd?: string | null;
  releaseStart?: string | null;
};

export function getReleaseBounds(release?: Release): ReleaseBounds {
  const retentionBound = moment().subtract(90, 'days');
  const {lastEvent, currentProjectMeta, dateCreated} = release || {};
  const {sessionsUpperBound} = currentProjectMeta || {};

  let type: ReleaseBounds['type'] = 'normal';
  let releaseStart = moment(dateCreated).startOf('minute');
  let releaseEnd = moment(
    (moment(sessionsUpperBound).isAfter(lastEvent) ? sessionsUpperBound : lastEvent) ??
      undefined
  ).endOf('minute');

  if (moment(releaseStart).isSame(releaseEnd, 'minute')) {
    releaseEnd = moment(releaseEnd).add(1, 'minutes');
  }

  if (releaseStart.isBefore(retentionBound)) {
    releaseStart = retentionBound;
    type = 'clamped';

    if (
      releaseEnd.isBefore(releaseStart) ||
      (!defined(sessionsUpperBound) && !defined(lastEvent))
    ) {
      releaseEnd = moment();
      type = 'ancient';
    }
  }

  return {
    type,
    releaseStart: releaseStart.utc().format(),
    releaseEnd: releaseEnd.utc().format(),
  };
}

type GetReleaseParams = {
  location: Location;
  releaseBounds: ReleaseBounds;
};

export function getReleaseParams({location, releaseBounds}: GetReleaseParams) {
  const params = normalizeDateTimeParams(
    pick(location.query, [
      ...Object.values(URL_PARAM),
      ...Object.values(PAGE_URL_PARAM),
      'cursor',
    ]),
    {
      allowAbsolutePageDatetime: true,
      allowEmptyPeriod: true,
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

const adoptionStagesLink = (
  <ExternalLink href="https://docs.sentry.io/product/releases/health/#adoption-stages" />
);

export const ADOPTION_STAGE_LABELS: Record<
  string,
  {name: string; tooltipTitle: React.ReactNode; type: TagProps['type']}
> = {
  low_adoption: {
    name: t('Low Adoption'),
    tooltipTitle: tct(
      'This release has a low percentage of sessions compared to other releases in this project. [link:Learn more]',
      {link: adoptionStagesLink}
    ),
    type: 'warning',
  },
  adopted: {
    name: t('Adopted'),
    tooltipTitle: tct(
      'This release has a high percentage of sessions compared to other releases in this project. [link:Learn more]',
      {link: adoptionStagesLink}
    ),
    type: 'success',
  },
  replaced: {
    name: t('Replaced'),
    tooltipTitle: tct(
      'This release was previously Adopted, but now has a lower level of sessions compared to other releases in this project. [link:Learn more]',
      {link: adoptionStagesLink}
    ),
    type: 'default',
  },
};

export const isMobileRelease = (releaseProjectPlatform: PlatformKey) =>
  ([...mobile, ...desktop] as string[]).includes(releaseProjectPlatform);

/**
 * Helper that escapes quotes and formats release version into release search
 * ex - com.sentry.go_app@"1.0.0-chore"
 */
export function searchReleaseVersion(version: string): string {
  // Wrap with quotes and escape any quotes inside
  return `release:"${version.replace(/"/g, '\\"')}"`;
}

export function isVersionInfoSemver(
  versionInfo: VersionInfo['version']
): versionInfo is SemverVersion {
  return versionInfo.hasOwnProperty('components');
}
