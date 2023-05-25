import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import {useTheme} from '@emotion/react';
import {Query} from 'history';

import EventsRequest from 'sentry/components/charts/eventsRequest';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {getInterval, getSeriesSelection} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {Organization, OrganizationSummary, Project} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import TrendsDiscoverQuery from 'sentry/utils/performance/trends/trendsDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';

import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendFunctionField,
  TrendView,
} from '../../../trends/types';
import {
  generateTrendFunctionAsString,
  getSelectedQueryKey,
  modifyTrendView,
  normalizeTrends,
} from '../../../trends/utils';
import {ViewProps} from '../../../types';

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
  const router = useRouter();
  const location = useLocation();
  const api = useApi();
  const theme = useTheme();

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
    browserHistory.push(to);
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
    router,
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

  function getSelectedTransaction(
    trendChangeType: TrendChangeType,
    transactions?: NormalizedTrendsTransaction[]
  ): NormalizedTrendsTransaction | undefined {
    const queryKey = getSelectedQueryKey(trendChangeType);
    const selectedTransactionName = decodeScalar(location.query[queryKey]);

    if (!transactions) {
      return undefined;
    }

    const selectedTransaction = transactions.find(
      transaction =>
        `${transaction.transaction}-${transaction.project}` === selectedTransactionName
    );

    if (selectedTransaction) {
      return selectedTransaction;
    }

    return transactions.length > 0 ? transactions[0] : undefined;
  }

  const trendView = eventView.clone() as TrendView;
  modifyTrendView(
    trendView,
    location,
    TrendChangeType.REGRESSION,
    projects,
    organization as Organization
  );

  return (
    <Fragment>
      {header}
      {withBreakpoint ? (
        // queries events-trends-statsv2 for breakpoint data
        <TrendsDiscoverQuery
          eventView={trendView}
          orgSlug={organization.slug}
          location={location}
          limit={1}
          withBreakpoint={withBreakpoint}
        >
          {({trendsData}) => {
            const events = normalizeTrends(
              (trendsData && trendsData.events && trendsData.events.data) || []
            );

            // keep trend change type as regression until the backend can support passing the type
            const selectedTransaction = getSelectedTransaction(
              TrendChangeType.REGRESSION,
              events
            );

            return (
              // queries events-stats for trend data
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
                {({
                  errored,
                  loading,
                  reloading,
                  timeseriesData,
                  timeframe: timeFrame,
                }) => {
                  return (
                    <Content
                      series={timeseriesData}
                      errored={errored}
                      loading={loading}
                      reloading={reloading}
                      timeFrame={timeFrame}
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
                loading={loading}
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
