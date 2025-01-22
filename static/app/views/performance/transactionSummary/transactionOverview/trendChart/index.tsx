import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import type {Query} from 'history';

import EventsRequest from 'sentry/components/charts/eventsRequest';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {getInterval, getSeriesSelection} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {
  EventsStats,
  EventsStatsData,
  OrganizationSummary,
} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import type EventView from 'sentry/utils/discover/eventView';
import {DURATION_UNITS, SIZE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import TrendsDiscoverQuery from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {TrendFunctionField, TrendView} from 'sentry/views/performance/trends/types';
import {TrendChangeType} from 'sentry/views/performance/trends/types';
import {modifyTrendView, normalizeTrends} from 'sentry/views/performance/trends/utils';
import generateTrendFunctionAsString from 'sentry/views/performance/trends/utils/generateTrendFunctionAsString';
import type {ViewProps} from 'sentry/views/performance/types';
import {getSelectedTransaction} from 'sentry/views/performance/utils/getSelectedTransaction';

import Content from './content';

type Props = ViewProps & {
  eventView: EventView;
  organization: OrganizationSummary;
  projects: Project[];
  queryExtra: Query;
  trendFunction: TrendFunctionField;
  trendParameter: string;
  withoutZerofill: boolean;
  withBreakpoint?: boolean;
};

function TrendChart({
  project,
  environment,
  organization,
  query,
  statsPeriod,
  trendFunction,
  trendParameter,
  queryExtra,
  withoutZerofill,
  withBreakpoint,
  eventView,
  start: propsStart,
  end: propsEnd,
  projects,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();
  const theme = useTheme();

  const {isLoading: isCardinalityCheckLoading, outcome} = useMetricsCardinalityContext();
  const shouldGetBreakpoint =
    withBreakpoint && !isCardinalityCheckLoading && !outcome?.forceTransactionsOnly;

  function handleLegendSelectChanged(legendChange: {
    name: string;
    selected: Record<string, boolean>;
    type: string;
  }) {
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const to = {
      ...location,
      query: {
        ...location.query,
        unselectedSeries: unselected,
      },
    };
    navigate(to);
  }

  const start = propsStart ? getUtcToLocalDateObject(propsStart) : null;
  const end = propsEnd ? getUtcToLocalDateObject(propsEnd) : null;
  const utc = normalizeDateTimeParams(location.query)?.utc === 'true';
  const period = statsPeriod;

  const legend = {
    right: 10,
    top: 0,
    selected: getSeriesSelection(location),
  };

  const datetimeSelection = {start, end, period};

  const contentCommonProps = {
    theme,
    start,
    end,
    utc,
    legend,
    queryExtra,
    period,
    projects: project,
    environments: environment,
    onLegendSelectChanged: handleLegendSelectChanged,
  };

  const requestCommonProps = {
    api,
    start,
    end,
    project,
    environment,
    query,
    period,
    interval: getInterval(datetimeSelection, 'high'),
  };

  const header = (
    <HeaderTitleLegend>
      {t('Trend')}
      <QuestionTooltip
        size="sm"
        position="top"
        title={t('Trends shows the smoothed value of an aggregate over time.')}
      />
    </HeaderTitleLegend>
  );

  const trendDisplay = generateTrendFunctionAsString(trendFunction, trendParameter);

  const trendView = eventView.clone() as TrendView;
  modifyTrendView(
    trendView,
    location,
    TrendChangeType.ANY,
    projects,
    shouldGetBreakpoint
  );

  function transformTimeseriesData(
    data: EventsStatsData,
    meta: EventsStats['meta'],
    seriesName: string
  ): Series[] {
    let scale = 1;
    if (seriesName) {
      const unit = meta?.units?.[getAggregateAlias(seriesName)];
      // Scale series values to milliseconds or bytes depending on units from meta
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      scale = (unit && (DURATION_UNITS[unit] ?? SIZE_UNITS[unit])) ?? 1;
    }

    return [
      {
        seriesName,
        data: data.map(([timestamp, countsForTimestamp]) => ({
          name: timestamp * 1000,
          value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0) * scale,
        })),
      },
    ];
  }

  return (
    <Fragment>
      {header}
      {shouldGetBreakpoint ? (
        // queries events-trends-statsv2 for breakpoint data (feature flag only)
        <TrendsDiscoverQuery
          eventView={trendView}
          orgSlug={organization.slug}
          location={location}
          limit={1}
          withBreakpoint
        >
          {({isLoading, trendsData}) => {
            const events = normalizeTrends(trendsData?.events?.data || []);

            // keep trend change type as regression until the backend can support passing the type
            const selectedTransaction = getSelectedTransaction(
              location,
              TrendChangeType.ANY,
              events
            );

            const statsData = trendsData?.stats || {};

            const transactionEvent = (
              statsData &&
              selectedTransaction?.project &&
              selectedTransaction?.transaction
                ? statsData[
                    [selectedTransaction?.project, selectedTransaction?.transaction].join(
                      ','
                    )
                  ]
                : undefined
            ) as EventsStats;
            const data = transactionEvent?.data ?? [];
            const meta = transactionEvent?.meta ?? ({} as EventsStats['meta']);
            const timeSeriesMetricsData = transformTimeseriesData(
              data,
              meta,
              trendDisplay
            );

            const metricsTimeFrame =
              transactionEvent?.start && transactionEvent.end
                ? {start: transactionEvent.start * 1000, end: transactionEvent.end * 1000}
                : undefined;

            return data.length !== 0 ? (
              <Content
                series={timeSeriesMetricsData}
                errored={!trendsData && !isLoading}
                loading={isLoading || isCardinalityCheckLoading}
                reloading={isLoading}
                timeFrame={metricsTimeFrame}
                withBreakpoint
                transaction={selectedTransaction}
                {...contentCommonProps}
              />
            ) : (
              // queries events-stats for trend data if metrics trend data not found
              <EventsRequest
                {...requestCommonProps}
                organization={organization}
                showLoading={false}
                includePrevious={false}
                yAxis={trendDisplay}
                currentSeriesNames={[trendDisplay]}
                partial
                withoutZerofill={withoutZerofill}
                referrer="api.performance.transaction-summary.trends-chart"
              >
                {({errored, loading, reloading, timeseriesData, timeframe}) => {
                  return (
                    <Content
                      series={timeseriesData}
                      errored={errored}
                      loading={loading || isLoading}
                      reloading={reloading}
                      timeFrame={timeframe}
                      withBreakpoint
                      transaction={selectedTransaction}
                      {...contentCommonProps}
                    />
                  );
                }}
              </EventsRequest>
            );
          }}
        </TrendsDiscoverQuery>
      ) : (
        <EventsRequest
          {...requestCommonProps}
          organization={organization}
          showLoading={false}
          includePrevious={false}
          yAxis={trendDisplay}
          currentSeriesNames={[trendDisplay]}
          partial
          withoutZerofill={withoutZerofill}
          referrer="api.performance.transaction-summary.trends-chart"
        >
          {({errored, loading, reloading, timeseriesData, timeframe: timeFrame}) => {
            return (
              <Content
                series={timeseriesData}
                errored={errored}
                loading={loading || isCardinalityCheckLoading}
                reloading={reloading}
                timeFrame={timeFrame}
                {...contentCommonProps}
              />
            );
          }}
        </EventsRequest>
      )}
    </Fragment>
  );
}

export default TrendChart;
