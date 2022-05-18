import {Fragment} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import {Location, Query} from 'history';

import EventsRequest from 'sentry/components/charts/eventsRequest';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {getInterval, getSeriesSelection} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {getMEPQueryParams} from 'sentry/views/performance/landing/widgets/utils';

import {ViewProps} from '../../../types';
import {
  SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD,
  SpanOperationBreakdownFilter,
} from '../../filter';

import Content from './content';

type Props = WithRouterProps &
  ViewProps & {
    currentFilter: SpanOperationBreakdownFilter;
    location: Location;
    organization: OrganizationSummary;
    queryExtra: Query;
    withoutZerofill: boolean;
  };

enum DurationFunctionField {
  P50 = 'p50',
  P75 = 'p75',
  P95 = 'p95',
  P99 = 'p99',
  p100 = 'p100',
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
  const mepContext = useMEPSettingContext();

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
  const utc = normalizeDateTimeParams(location.query).utc === 'true';
  const period = statsPeriod;

  const legend = {right: 10, top: 5, selected: getSeriesSelection(location)};
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

  const parameter = SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD[currentFilter] ?? '';

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

  const yAxis = Object.values(DurationFunctionField).map(v => `${v}(${parameter})`);

  return (
    <Fragment>
      {header}
      <EventsRequest
        {...requestCommonProps}
        organization={organization}
        showLoading={false}
        includePrevious={false}
        yAxis={yAxis}
        partial
        withoutZerofill={withoutZerofill}
        referrer="api.performance.transaction-summary.duration-chart"
        queryExtras={getMEPQueryParams(mepContext)}
        userModified={decodeScalar(location.query.userModified)}
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
