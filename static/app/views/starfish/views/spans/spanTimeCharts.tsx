import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import {space} from 'sentry/styles/space';
import {PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {RateUnits} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatRate} from 'sentry/utils/formatters';
import usePageFilters from 'sentry/utils/usePageFilters';
import {AVG_COLOR, ERRORS_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {useErrorRateQuery as useErrorCountQuery} from 'sentry/views/starfish/views/spans/queries';
import {EMPTY_OPTION_VALUE} from 'sentry/views/starfish/views/spans/selectors/emptyOption';
import {
  DataTitles,
  getDurationChartTitle,
  getThroughputChartTitle,
} from 'sentry/views/starfish/views/spans/types';
import {ModuleFilters} from 'sentry/views/starfish/views/spans/useModuleFilters';
import {NULL_SPAN_CATEGORY} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

const {SPAN_SELF_TIME, SPAN_MODULE, SPAN_DESCRIPTION, SPAN_DOMAIN} = SpanMetricsField;

const CHART_HEIGHT = 140;

type Props = {
  appliedFilters: ModuleFilters;
  moduleName: ModuleName;
  eventView?: EventView;
  extraQuery?: string[];
  spanCategory?: string;
  throughputUnit?: RateUnits;
};

type ChartProps = {
  filters: ModuleFilters;
  moduleName: ModuleName;
  throughputUnit: RateUnits;
  extraQuery?: string[];
};

function getSegmentLabel(moduleName: ModuleName) {
  return moduleName === ModuleName.DB ? 'Queries' : 'Requests';
}

export function SpanTimeCharts({
  moduleName,
  appliedFilters,
  spanCategory,
  throughputUnit = RateUnits.PER_MINUTE,
  extraQuery,
}: Props) {
  const {selection} = usePageFilters();

  const eventView = getEventView(moduleName, selection, appliedFilters, spanCategory);
  if (extraQuery) {
    eventView.query += ` ${extraQuery.join(' ')}`;
  }

  const {isLoading} = useSpansQuery({
    eventView,
    initialData: [],
    referrer: 'api.starfish.span-time-charts',
  });

  useSynchronizeCharts([!isLoading]);

  const moduleCharts: Record<
    ModuleName,
    {Comp: (props: ChartProps) => JSX.Element; title: string}[]
  > = {
    [ModuleName.ALL]: [
      {title: getThroughputChartTitle(moduleName, throughputUnit), Comp: ThroughputChart},
      {title: getDurationChartTitle(moduleName), Comp: DurationChart},
    ],
    [ModuleName.DB]: [],
    [ModuleName.RESOURCE]: [],
    [ModuleName.HTTP]: [{title: DataTitles.errorCount, Comp: ErrorChart}],
    [ModuleName.OTHER]: [],
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
            <Comp
              moduleName={moduleName}
              filters={appliedFilters}
              throughputUnit={throughputUnit}
              extraQuery={extraQuery}
            />
          </ChartPanel>
        </ChartsContainerItem>
      ))}
    </ChartsContainer>
  );
}

function ThroughputChart({
  moduleName,
  filters,
  throughputUnit,
  extraQuery,
}: ChartProps): JSX.Element {
  const pageFilters = usePageFilters();
  const eventView = getEventView(moduleName, pageFilters.selection, filters);
  if (extraQuery) {
    eventView.query += ` ${extraQuery.join(' ')}`;
  }

  const label = getSegmentLabel(moduleName);
  const {isLoading, data} = useSpansQuery<
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

    let throughputMultiplier = 1; // We're fetching per minute, so default is 1
    if (throughputUnit === RateUnits.PER_SECOND) {
      throughputMultiplier = 1 / 60;
    } else if (throughputUnit === RateUnits.PER_HOUR) {
      throughputMultiplier = 60;
    }

    return {
      seriesName: label ?? 'Throughput',
      data: (groupData ?? []).map(datum => ({
        value: datum['spm()'] * throughputMultiplier,
        name: datum.interval,
      })),
    };
  });

  return (
    <Chart
      height={CHART_HEIGHT}
      data={throughputTimeSeries}
      loading={isLoading}
      grid={{
        left: '0',
        right: '0',
        top: '8px',
        bottom: '0',
      }}
      definedAxisTicks={4}
      aggregateOutputFormat="rate"
      rateUnit={throughputUnit}
      stacked
      isLineChart
      chartColors={[THROUGHPUT_COLOR]}
      tooltipFormatterOptions={{
        valueFormatter: value => formatRate(value, throughputUnit),
      }}
    />
  );
}

function DurationChart({moduleName, filters, extraQuery}: ChartProps): JSX.Element {
  const pageFilters = usePageFilters();
  const eventView = getEventView(moduleName, pageFilters.selection, filters);
  if (extraQuery) {
    eventView.query += ` ${extraQuery.join(' ')}`;
  }

  const label = `avg(${SPAN_SELF_TIME})`;

  const {isLoading, data} = useSpansQuery<
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
    <Chart
      height={CHART_HEIGHT}
      data={[...avgSeries]}
      loading={isLoading}
      grid={{
        left: '0',
        right: '0',
        top: '8px',
        bottom: '0',
      }}
      definedAxisTicks={4}
      stacked
      isLineChart
      chartColors={[AVG_COLOR]}
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
      height={CHART_HEIGHT}
      data={[errorRateSeries]}
      loading={isLoading}
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

const SPAN_FILTER_KEYS = ['span_operation', SPAN_DOMAIN, 'action'];

const getEventView = (
  moduleName: ModuleName,
  pageFilters: PageFilters,
  appliedFilters: ModuleFilters,
  spanCategory?: string
) => {
  const query = buildDiscoverQueryConditions(moduleName, appliedFilters, spanCategory);

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

const buildDiscoverQueryConditions = (
  moduleName: ModuleName,
  appliedFilters: ModuleFilters,
  spanCategory?: string
) => {
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

  if (moduleName !== ModuleName.ALL) {
    result.push(`${SPAN_MODULE}:${moduleName}`);
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
