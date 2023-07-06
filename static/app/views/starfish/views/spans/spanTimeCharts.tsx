import styled from '@emotion/styled';
import {Location} from 'history';

import {getInterval} from 'sentry/components/charts/utils';
import {space} from 'sentry/styles/space';
import {PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ERRORS_COLOR, P95_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {ModuleName, SpanMetricsFields} from 'sentry/views/starfish/types';
import formatThroughput from 'sentry/views/starfish/utils/chartValueFormatters/formatThroughput';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {useErrorRateQuery as useErrorCountQuery} from 'sentry/views/starfish/views/spans/queries';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {NULL_SPAN_CATEGORY} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

const {SPAN_SELF_TIME} = SpanMetricsFields;

type Props = {
  appliedFilters: AppliedFilters;
  moduleName: ModuleName;
  spanCategory?: string;
};

type AppliedFilters = {
  'span.action': string;
  'span.domain': string;
  'span.group': string;
  'span.op': string;
};

type ChartProps = {
  filters: AppliedFilters;
  moduleName: ModuleName;
};

function getSegmentLabel(moduleName: ModuleName) {
  return moduleName === ModuleName.DB ? 'Queries' : 'Requests';
}

export function SpanTimeCharts({moduleName, appliedFilters, spanCategory}: Props) {
  const {selection} = usePageFilters();
  const location = useLocation();

  const eventView = getEventView(
    moduleName,
    location,
    selection,
    appliedFilters,
    spanCategory
  );

  const {isLoading} = useSpansQuery({
    eventView,
    initialData: [],
  });

  useSynchronizeCharts([!isLoading]);

  const moduleCharts: Record<
    ModuleName,
    {Comp: (props: ChartProps) => JSX.Element; title: string}[]
  > = {
    [ModuleName.ALL]: [
      {title: DataTitles.throughput, Comp: ThroughputChart},
      {title: DataTitles.p95, Comp: DurationChart},
    ],
    [ModuleName.DB]: [],
    [ModuleName.HTTP]: [{title: DataTitles.errorCount, Comp: ErrorChart}],
    [ModuleName.NONE]: [],
  };

  const charts = [...moduleCharts[ModuleName.ALL]];
  if (moduleName !== ModuleName.ALL) {
    charts.push(...moduleCharts[moduleName]);
  }

  return (
    <ChartsContainer>
      {charts.map(({title, Comp}) => (
        <ChartsContainerItem key={title}>
          <ChartPanel title={title}>
            <Comp moduleName={moduleName} filters={appliedFilters} />
          </ChartPanel>
        </ChartsContainerItem>
      ))}
    </ChartsContainer>
  );
}

function ThroughputChart({moduleName, filters}: ChartProps): JSX.Element {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const eventView = getEventView(moduleName, location, pageFilters.selection, filters);

  const label = getSegmentLabel(moduleName);
  const {isLoading, data} = useSpansQuery({
    eventView,
    initialData: [],
  });
  const dataByGroup = {[label]: data};

  const throughputTimeSeries = Object.keys(dataByGroup).map(groupName => {
    const groupData = dataByGroup[groupName];

    return {
      seriesName: label ?? 'Throughput',
      data: groupData.map(datum => ({
        value: datum['sps()'],
        name: datum.interval,
      })),
    };
  });

  return (
    <Chart
      statsPeriod="24h"
      height={100}
      data={throughputTimeSeries}
      start=""
      end=""
      loading={isLoading}
      utc={false}
      grid={{
        left: '0',
        right: '0',
        top: '8px',
        bottom: '0',
      }}
      definedAxisTicks={4}
      aggregateOutputFormat="rate"
      stacked
      isLineChart
      chartColors={[THROUGHPUT_COLOR]}
      tooltipFormatterOptions={{
        valueFormatter: value => formatThroughput(value),
      }}
    />
  );
}

function DurationChart({moduleName, filters}: ChartProps): JSX.Element {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const eventView = getEventView(moduleName, location, pageFilters.selection, filters);

  const label = `p95(${SPAN_SELF_TIME})`;

  const {isLoading, data} = useSpansQuery({
    eventView,
    initialData: [],
  });
  const dataByGroup = {[label]: data};

  const p95Series = Object.keys(dataByGroup).map(groupName => {
    const groupData = dataByGroup[groupName];

    return {
      seriesName: label,
      data: groupData.map(datum => ({
        value: datum[`p95(${SPAN_SELF_TIME})`],
        name: datum.interval,
      })),
    };
  });

  return (
    <Chart
      statsPeriod="24h"
      height={100}
      data={[...p95Series]}
      start=""
      end=""
      loading={isLoading}
      utc={false}
      grid={{
        left: '0',
        right: '0',
        top: '8px',
        bottom: '0',
      }}
      definedAxisTicks={4}
      stacked
      isLineChart
      chartColors={[P95_COLOR]}
    />
  );
}

function ErrorChart({moduleName, filters}: ChartProps): JSX.Element {
  const query = buildDiscoverQueryConditions(moduleName, filters);
  const {isLoading, data} = useErrorCountQuery(query);

  const errorRateSeries: Series = {
    seriesName: DataTitles.errorCount,
    data: data?.length
      ? data?.map(entry => ({
          name: entry.interval,
          value: entry['http_error_count()'],
        }))
      : [],
  };

  return (
    <Chart
      statsPeriod="24h"
      height={100}
      data={[errorRateSeries]}
      start=""
      end=""
      loading={isLoading}
      utc={false}
      grid={{
        left: '0',
        right: '0',
        top: '8px',
        bottom: '0',
      }}
      definedAxisTicks={4}
      stacked
      isLineChart
      chartColors={[ERRORS_COLOR]}
    />
  );
}

const SPAN_FILTER_KEYS = ['span_operation', 'domain', 'action'];

const getEventView = (
  moduleName: ModuleName,
  location: Location,
  pageFilters: PageFilters,
  appliedFilters: AppliedFilters,
  spanCategory?: string
) => {
  const query = buildDiscoverQueryConditions(moduleName, appliedFilters, spanCategory);

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      fields: [''],
      yAxis: ['sps()', `p50(${SPAN_SELF_TIME})`, `p95(${SPAN_SELF_TIME})`],
      query,
      dataset: DiscoverDatasets.SPANS_METRICS,
      interval: getInterval(pageFilters.datetime, 'low'),
      version: 2,
    },
    location
  );
};

const buildDiscoverQueryConditions = (
  moduleName: ModuleName,
  appliedFilters: AppliedFilters,
  spanCategory?: string
) => {
  const result = Object.keys(appliedFilters)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .filter(key => Boolean(appliedFilters[key]))
    .map(key => {
      return `${key}:${appliedFilters[key]}`;
    });

  result.push('has:span.description');

  if (moduleName !== ModuleName.ALL) {
    result.push(`span.module:${moduleName}`);
  }

  if (moduleName === ModuleName.DB) {
    result.push('!span.op:db.redis');
  }

  if (spanCategory) {
    if (spanCategory === NULL_SPAN_CATEGORY) {
      result.push(`!has:span.category`);
    } else if (spanCategory !== 'Other') {
      result.push(`span.category:${spanCategory}`);
    }
  }

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
