import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import type {Query} from 'history';

import EventsRequest from 'sentry/components/charts/eventsRequest';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {getInterval, getSeriesSelection} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import type {OrganizationSummary} from 'sentry/types/organization';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {parseFunction} from 'sentry/utils/discover/fields';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useRouter from 'sentry/utils/useRouter';

import type {ViewProps} from '../../../types';
import {
  SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD,
  SpanOperationBreakdownFilter,
} from '../../filter';

import Content from './content';

type Props = ViewProps & {
  currentFilter: SpanOperationBreakdownFilter;
  organization: OrganizationSummary;
  queryExtra: Query;
  withoutZerofill: boolean;
  queryExtras?: Record<string, string>;
};

const yAxisValues = ['p50', 'p75', 'p95', 'p99', 'p100', 'avg'];

/**
 * Fetch and render a stacked area chart that shows duration percentiles over
 * the past 7 days
 */
function DurationChart({
  project,
  environment,
  organization,
  query,
  statsPeriod,
  queryExtra,
  currentFilter,
  withoutZerofill,
  start: propsStart,
  end: propsEnd,
  queryExtras,
}: Props) {
  const navigate = useNavigate();
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

    navigate(to);
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

  const parameter =
    SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD[currentFilter] ?? 'transaction.duration';

  const header = (
    <HeaderTitleLegend>
      {currentFilter === SpanOperationBreakdownFilter.NONE
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

  const yAxis = yAxisValues.map(v => `${v}(${parameter})`);

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
        queryExtras={queryExtras}
      >
        {({results, errored, loading, reloading, timeframe: timeFrame}) => {
          const stripParamsForLegend = (seriesResults: any) =>
            seriesResults?.map((series: any) => ({
              ...series,
              seriesName: `${parseFunction(series.seriesName)?.name}()`,
            }));
          return (
            <Content
              series={stripParamsForLegend(results)}
              errored={errored}
              loading={loading}
              reloading={reloading}
              timeFrame={timeFrame}
              {...contentCommonProps}
            />
          );
        }}
      </EventsRequest>
    </Fragment>
  );
}

export default DurationChart;
