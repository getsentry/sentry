import {shouldFetchPreviousPeriod} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {useApiQuery} from 'sentry/utils/queryClient';
import {BigNumberWidget} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidget';
import {WidgetFrame} from 'sentry/views/dashboards/widgets/common/widgetFrame';
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

  const cardTitle = t('Apdex');

  const cardHelp = getTermHelp(organization, PerformanceTerm.APDEX);

  if (!hasTransactions || !organization.features.includes('performance-view')) {
    return (
      <WidgetFrame title={cardTitle} description={cardHelp}>
        <MissingPerformanceButtons organization={organization} />
      </WidgetFrame>
    );
  }

  return (
    <BigNumberWidget
      title={cardTitle}
      description={cardHelp}
      data={[
        {
          'apdex()': apdex,
        },
      ]}
      previousPeriodData={[
        {
          'apdex()': previousApdex,
        },
      ]}
      meta={{
        fields: {
          'apdex()': 'number',
        },
      }}
      preferredPolarity="+"
      isLoading={isLoading}
      error={error ?? undefined}
      onRetry={refetch}
    />
  );
}

export default ProjectApdexScoreCard;
