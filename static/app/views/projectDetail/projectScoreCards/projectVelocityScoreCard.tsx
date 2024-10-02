import {Fragment} from 'react';

import {shouldFetchPreviousPeriod} from 'sentry/components/charts/utils';
import LoadingError from 'sentry/components/loadingError';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import ScoreCard from 'sentry/components/scoreCard';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {useApiQuery} from 'sentry/utils/queryClient';

import MissingReleasesButtons from '../missingFeatureButtons/missingReleasesButtons';

const API_LIMIT = 1000;

type Release = {date: string; version: string};

const useReleaseCount = (props: Props) => {
  const {organization, selection, isProjectStabilized, query} = props;

  const isEnabled = isProjectStabilized;
  const {projects, environments, datetime} = selection;
  const {period} = datetime;

  const {start: previousStart} = parseStatsPeriod(
    getPeriod({period, start: undefined, end: undefined}, {shouldDoublePeriod: true})
      .statsPeriod!
  );

  const {start: previousEnd} = parseStatsPeriod(
    getPeriod({period, start: undefined, end: undefined}, {shouldDoublePeriod: false})
      .statsPeriod!
  );

  const commonQuery = {
    environment: environments,
    project: projects[0],
    query,
  };

  const currentQuery = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/stats/`,
      {
        query: {
          ...commonQuery,
          ...normalizeDateTimeParams(datetime),
        },
      },
    ],
    {staleTime: 0, enabled: isEnabled}
  );

  const isPreviousPeriodEnabled = shouldFetchPreviousPeriod({
    start: datetime.start,
    end: datetime.end,
    period: datetime.period,
  });

  const previousQuery = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/stats/`,
      {
        query: {
          ...commonQuery,
          start: previousStart,
          end: previousEnd,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: isEnabled && isPreviousPeriodEnabled,
    }
  );

  const allReleases = [...(currentQuery.data ?? []), ...(previousQuery.data ?? [])];

  const isAllTimePeriodEnabled =
    !currentQuery.isPending &&
    !currentQuery.error &&
    !previousQuery.isPending &&
    !previousQuery.error &&
    allReleases.length === 0;

  const allTimeQuery = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/stats/`,
      {
        query: {
          ...commonQuery,
          statsPeriod: '90d',
          per_page: 1,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: isEnabled && isAllTimePeriodEnabled,
    }
  );

  return {
    data: currentQuery.data,
    previousData: previousQuery.data,
    allTimeData: allTimeQuery.data,
    isLoading:
      currentQuery.isPending ||
      (previousQuery.isPending && isPreviousPeriodEnabled) ||
      (allTimeQuery.isPending && isAllTimePeriodEnabled),
    error: currentQuery.error || previousQuery.error || allTimeQuery.error,
    refetch: () => {
      currentQuery.refetch();
      previousQuery.refetch();
      allTimeQuery.refetch();
    },
  };
};

type Props = {
  isProjectStabilized: boolean;
  organization: Organization;
  selection: PageFilters;
  query?: string;
};

function ProjectVelocityScoreCard(props: Props) {
  const {organization} = props;

  const {
    data: currentReleases,
    previousData: previousReleases,
    allTimeData: allTimeReleases,
    isLoading,
    error,
    refetch,
  } = useReleaseCount(props);

  const trend =
    defined(currentReleases) &&
    defined(previousReleases) &&
    currentReleases?.length !== API_LIMIT
      ? currentReleases.length - previousReleases.length
      : undefined;

  const shouldRenderTrend =
    !isLoading && defined(currentReleases) && defined(previousReleases) && defined(trend);

  const noReleaseEver =
    [...(allTimeReleases ?? []), ...(previousReleases ?? []), ...(allTimeReleases ?? [])]
      .length === 0;

  const cardTitle = t('Number of Releases');

  const cardHelp = trend
    ? t(
        'The number of releases for this project and how it has changed since the last period.'
      )
    : t('The number of releases for this project.');

  if (noReleaseEver) {
    return (
      <ScoreCard
        title={cardTitle}
        help={cardHelp}
        score={<MissingReleasesButtons organization={organization} />}
      />
    );
  }

  if (error) {
    return (
      <LoadingError
        message={
          (error.responseJSON?.detail as React.ReactNode) ||
          t('There was an error loading data.')
        }
        onRetry={refetch}
      />
    );
  }

  return (
    <ScoreCard
      title={cardTitle}
      help={cardHelp}
      score={
        isLoading || !defined(currentReleases)
          ? '\u2014'
          : currentReleases.length === API_LIMIT
            ? `${API_LIMIT - 1}+`
            : currentReleases.length
      }
      trend={
        shouldRenderTrend ? (
          <Fragment>
            {trend >= 0 ? (
              <IconArrow direction="up" size="xs" />
            ) : (
              <IconArrow direction="down" size="xs" />
            )}
            {Math.abs(trend)}
          </Fragment>
        ) : null
      }
      trendStatus={!trend ? undefined : trend > 0 ? 'good' : 'bad'}
    />
  );
}

export default ProjectVelocityScoreCard;
