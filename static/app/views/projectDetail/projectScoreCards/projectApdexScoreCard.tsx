import {Fragment} from 'react';
import round from 'lodash/round';

import {shouldFetchPreviousPeriod} from 'sentry/components/charts/utils';
import Count from 'sentry/components/count';
import LoadingError from 'sentry/components/loadingError';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import ScoreCard from 'sentry/components/scoreCard';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {useApiQuery} from 'sentry/utils/queryClient';
import {getTermHelp, PerformanceTerm} from 'sentry/views/performance/data';

import MissingPerformanceButtons from '../missingFeatureButtons/missingPerformanceButtons';

type Props = {
  isProjectStabilized: boolean;
  organization: Organization;
  selection: PageFilters;
  hasTransactions?: boolean;
  query?: string;
};

const useApdex = (props: Props) => {
  const {organization, selection, isProjectStabilized, hasTransactions, query} = props;

  const isEnabled = !!(
    organization.features.includes('performance-view') &&
    isProjectStabilized &&
    hasTransactions
  );
  const {projects, environments: environments, datetime} = selection;
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
    project: projects.map(proj => String(proj)),
    field: ['apdex()'],
    query: ['event.type:transaction count():>0', query].join(' ').trim(),
  };

  const currentQuery = useApiQuery<TableData>(
    [
      `/organizations/${organization.slug}/events/`,
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

  const previousQuery = useApiQuery<TableData>(
    [
      `/organizations/${organization.slug}/events/`,
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

  return {
    data: currentQuery.data,
    previousData: previousQuery.data,
    isLoading:
      currentQuery.isPending || (previousQuery.isPending && isPreviousPeriodEnabled),
    error: currentQuery.error || previousQuery.error,
    refetch: () => {
      currentQuery.refetch();
      previousQuery.refetch();
    },
  };
};

function ProjectApdexScoreCard(props: Props) {
  const {organization, hasTransactions} = props;

  const {data, previousData, isLoading, error, refetch} = useApdex(props);

  const apdex = Number(data?.data?.[0]?.['apdex()']) || undefined;

  const previousApdex = Number(previousData?.data?.[0]?.['apdex()']) || undefined;

  const trend =
    defined(apdex) && defined(previousApdex)
      ? round(apdex - previousApdex, 3)
      : undefined;

  const shouldRenderTrend = !isLoading && defined(apdex) && defined(trend);

  const cardTitle = t('Apdex');

  let cardHelp = getTermHelp(organization, PerformanceTerm.APDEX);

  if (trend) {
    cardHelp += t(' This shows how it has changed since the last period.');
  }

  if (!hasTransactions || !organization.features.includes('performance-view')) {
    return (
      <ScoreCard
        title={cardTitle}
        help={cardHelp}
        score={<MissingPerformanceButtons organization={organization} />}
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
      score={isLoading || !defined(apdex) ? '\u2014' : <Count value={apdex} />}
      trend={
        shouldRenderTrend ? (
          <Fragment>
            {trend >= 0 ? (
              <IconArrow direction="up" size="xs" />
            ) : (
              <IconArrow direction="down" size="xs" />
            )}
            <Count value={Math.abs(trend)} />
          </Fragment>
        ) : null
      }
      trendStatus={!trend ? undefined : trend > 0 ? 'good' : 'bad'}
    />
  );
}

export default ProjectApdexScoreCard;
