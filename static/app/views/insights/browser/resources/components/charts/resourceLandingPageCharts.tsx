import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatRate} from 'sentry/utils/formatters';
import {EMPTY_OPTION_VALUE} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {AVG_COLOR, THROUGHPUT_COLOR} from 'sentry/views/insights/colors';
import Chart, {
  ChartType,
  useSynchronizeCharts,
} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/insights/common/utils/constants';
import {
  getDurationChartTitle,
  getThroughputChartTitle,
} from 'sentry/views/insights/common/views/spans/types';
import type {ModuleFilters} from 'sentry/views/insights/common/views/spans/useModuleFilters';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

import {RESOURCE_THROUGHPUT_UNIT} from '../../settings';

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_DOMAIN} = SpanMetricsField;

const CHART_HEIGHT = 140;

type Props = {
  appliedFilters: ModuleFilters;
  extraQuery?: string[];
};

type ChartProps = {
  filters: ModuleFilters;
  title: string;
  extraQuery?: string[];
};

export function ResourceLandingPageCharts({appliedFilters, extraQuery}: Props) {
  const moduleName = ModuleName.RESOURCE;
  const {selection} = usePageFilters();

  const eventView = getEventView(selection, appliedFilters);

  if (extraQuery) {
    eventView.query += ` ${extraQuery.join(' ')}`;
  }

  const {isPending} = useSpansQuery({
    eventView,
    initialData: [],
    referrer: 'api.starfish.span-time-charts',
  });

  useSynchronizeCharts(1, !isPending);

  return (
    <ChartsContainer>
      <ChartsContainerItem>
        <ThroughputChart
          title={getThroughputChartTitle(moduleName, RESOURCE_THROUGHPUT_UNIT)}
          filters={appliedFilters}
          extraQuery={extraQuery}
        />
      </ChartsContainerItem>

      <ChartsContainerItem>
        <DurationChart
          title={getDurationChartTitle(moduleName)}
          filters={appliedFilters}
          extraQuery={extraQuery}
        />
      </ChartsContainerItem>
    </ChartsContainer>
  );
}

function ThroughputChart({title, filters, extraQuery}: ChartProps): JSX.Element {
  const pageFilters = usePageFilters();
  const eventView = getEventView(pageFilters.selection, filters);
  if (extraQuery) {
    eventView.query += ` ${extraQuery.join(' ')}`;
  }

  const label = 'Requests';
  const {isPending, data} = useSpansQuery<
    {
      'avg(span.self_time)': number;
      interval: number;
      'spm()': number;
    }[]
  >({
    eventView,
    initialData: [],
    referrer: 'api.starfish.span-time-charts',
  });
  const dataByGroup = {[label]: data};

  const throughputTimeSeries = Object.keys(dataByGroup).map(groupName => {
    const groupData = dataByGroup[groupName];

    return {
      seriesName: label ?? 'Throughput',
      data: (groupData ?? []).map(datum => ({
        value: datum['spm()'],
        name: datum.interval,
      })),
    };
  });

  return (
    <ChartPanel title={title}>
      <Chart
        height={CHART_HEIGHT}
        data={throughputTimeSeries}
        loading={isPending}
        grid={{
          left: '0',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        definedAxisTicks={4}
        aggregateOutputFormat="rate"
        rateUnit={RESOURCE_THROUGHPUT_UNIT}
        stacked
        type={ChartType.LINE}
        chartColors={[THROUGHPUT_COLOR]}
        tooltipFormatterOptions={{
          valueFormatter: value => formatRate(value, RESOURCE_THROUGHPUT_UNIT),
        }}
      />
    </ChartPanel>
  );
}

function DurationChart({title, filters, extraQuery}: ChartProps): JSX.Element {
  const pageFilters = usePageFilters();
  const eventView = getEventView(pageFilters.selection, filters);
  if (extraQuery) {
    eventView.query += ` ${extraQuery.join(' ')}`;
  }

  const label = `avg(${SPAN_SELF_TIME})`;

  const {isPending, data} = useSpansQuery<
    {
      'avg(span.self_time)': number;
      interval: number;
      'spm()': number;
    }[]
  >({
    eventView,
    initialData: [],
    referrer: 'api.starfish.span-time-charts',
  });
  const dataByGroup = {[label]: data};

  const avgSeries = Object.keys(dataByGroup).map(groupName => {
    const groupData = dataByGroup[groupName];

    return {
      seriesName: label,
      data: (groupData ?? []).map(datum => ({
        value: datum[`avg(${SPAN_SELF_TIME})`],
        name: datum.interval,
      })),
    };
  });

  return (
    <ChartPanel title={title}>
      <Chart
        height={CHART_HEIGHT}
        data={[...avgSeries]}
        loading={isPending}
        grid={{
          left: '0',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        definedAxisTicks={4}
        stacked
        type={ChartType.LINE}
        chartColors={[AVG_COLOR]}
      />
    </ChartPanel>
  );
}

const SPAN_FILTER_KEYS = ['span_operation', SPAN_DOMAIN, 'action'];

const getEventView = (pageFilters: PageFilters, appliedFilters: ModuleFilters) => {
  const query = buildDiscoverQueryConditions(appliedFilters);

  return EventView.fromNewQueryWithPageFilters(
    {
      name: '',
      fields: [''],
      yAxis: ['spm()', `avg(${SPAN_SELF_TIME})`],
      query,
      dataset: DiscoverDatasets.SPANS_METRICS,
      interval: getInterval(pageFilters.datetime, STARFISH_CHART_INTERVAL_FIDELITY),
      version: 2,
    },
    pageFilters
  );
};

const buildDiscoverQueryConditions = (appliedFilters: ModuleFilters) => {
  const result = Object.keys(appliedFilters)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .filter(key => Boolean(appliedFilters[key]))
    .map(key => {
      const value = appliedFilters[key];
      if (key === SPAN_DOMAIN && value === EMPTY_OPTION_VALUE) {
        return [`!has:${SPAN_DOMAIN}`];
      }
      return `${key}:${value}`;
    });

  result.push(`has:${SPAN_DESCRIPTION}`);

  return result.join(' ');
};

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const ChartsContainerItem = styled('div')`
  flex: 1;
`;
