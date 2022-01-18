import {Fragment} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location, Query} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {getInterval, getSeriesSelection} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import {useMetricsSwitch} from 'sentry/views/performance/metricsSwitch';

import {
  SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD,
  SpanOperationBreakdownFilter,
} from '../../filter';

import Content from './content';

const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type Props = WithRouterProps &
  ViewProps & {
    location: Location;
    organization: OrganizationSummary;
    queryExtra: Query;
    currentFilter: SpanOperationBreakdownFilter;
    withoutZerofill: boolean;
  };

function generateYAxisValues(currentFilter: SpanOperationBreakdownFilter) {
  const field = SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD[currentFilter] ?? '';
  return [
    `p50(${field})`,
    `p75(${field})`,
    `p95(${field})`,
    `p99(${field})`,
    `p100(${field})`,
  ];
}

/**
 * Fetch and render a stacked area chart that shows duration percentiles over
 * the past 7 days
 */
function DurationChart({
  project,
  environment,
  location,
  organization,
  query,
  statsPeriod,
  router,
  queryExtra,
  currentFilter,
  withoutZerofill,
  start: propsStart,
  end: propsEnd,
}: Props) {
  const api = useApi();
  const theme = useTheme();
  const {isMetricsData} = useMetricsSwitch();

  function handleLegendSelectChanged(legendChange: {
    name: string;
    type: string;
    selected: Record<string, boolean>;
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

  const legend = {
    right: 10,
    top: 5,
    selected: getSeriesSelection(location),
  };

  const datetimeSelection = {
    start,
    end,
    period: statsPeriod,
  };

  const contentCommonProps = {
    theme,
    router,
    projects: project,
    environments: environment,
    start,
    end,
    period: statsPeriod,
    utc,
    legend,
    queryExtra,
    onLegendSelectChanged: handleLegendSelectChanged,
  };

  const requestCommonProps = {
    api,
    start,
    end,
    statsPeriod,
    project,
    environment,
    query,
    interval: getInterval(datetimeSelection, 'high'),
  };

  const header = (
    <HeaderTitleLegend>
      {currentFilter === SpanOperationBreakdownFilter.None
        ? t('Duration Breakdown')
        : tct('Span Operation Breakdown - [operationName]', {
            operationName: currentFilter,
          })}
      <QuestionTooltip
        size="sm"
        position="top"
        title={t(
          `Duration Breakdown reflects transaction durations by percentile over time.`
        )}
      />
    </HeaderTitleLegend>
  );

  if (isMetricsData) {
    return (
      <Fragment>
        {header}
        <ErrorPanel>TODO: P* Duration</ErrorPanel>
      </Fragment>
    );
  }

  return (
    <Fragment>
      {header}
      <EventsRequest
        {...requestCommonProps}
        organization={organization}
        showLoading={false}
        includePrevious={false}
        yAxis={generateYAxisValues(currentFilter)}
        partial
        withoutZerofill={withoutZerofill}
        referrer="api.performance.transaction-summary.duration-chart"
      >
        {({results, errored, loading, reloading, timeframe: timeFrame}) => (
          <Content
            series={results}
            errored={errored}
            loading={loading}
            reloading={reloading}
            timeFrame={timeFrame}
            {...contentCommonProps}
          />
        )}
      </EventsRequest>
    </Fragment>
  );
}

export default withRouter(DurationChart);
