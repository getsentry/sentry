import {Button} from 'sentry/components/button';
import {shouldFetchPreviousPeriod} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {useApiQuery} from 'sentry/utils/queryClient';
import {BigNumberWidgetVisualization} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {getTermHelp, PerformanceTerm} from 'sentry/views/performance/data';

import MissingPerformanceButtons from '../missingFeatureButtons/missingPerformanceButtons';

import {ActionWrapper} from './actionWrapper';

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
    {staleTime: Infinity, enabled: isEnabled}
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
      staleTime: Infinity,
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

  const Title = <Widget.WidgetTitle title={cardTitle} />;

  if (!hasTransactions || !organization.features.includes('performance-view')) {
    return (
      <Widget
        Title={Title}
        Visualization={
          <ActionWrapper>
            <MissingPerformanceButtons organization={organization} />
          </ActionWrapper>
        }
      />
    );
  }

  if (isLoading || !defined(apdex)) {
    return (
      <Widget
        Title={Title}
        Visualization={<BigNumberWidgetVisualization.LoadingPlaceholder />}
      />
    );
  }

  if (error) {
    return (
      <Widget
        Title={Title}
        Actions={
          <Widget.WidgetToolbar>
            <Button size="xs" onClick={refetch}>
              {t('Retry')}
            </Button>
          </Widget.WidgetToolbar>
        }
        Visualization={<Widget.WidgetError error={error} />}
      />
    );
  }

  return (
    <Widget
      Title={Title}
      Actions={
        <Widget.WidgetToolbar>
          <Widget.WidgetDescription description={cardHelp} />
        </Widget.WidgetToolbar>
      }
      Visualization={
        <BigNumberWidgetVisualization
          value={apdex}
          previousPeriodValue={previousApdex}
          field="apdex()"
          meta={{
            fields: {
              'apdex()': 'number',
            },
            units: {},
          }}
          preferredPolarity="+"
        />
      }
    />
  );
}

export default ProjectApdexScoreCard;
