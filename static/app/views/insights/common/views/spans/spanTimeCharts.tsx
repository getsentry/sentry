import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {RateUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatRate} from 'sentry/utils/formatters';
import {EMPTY_OPTION_VALUE} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {AVG_COLOR, ERRORS_COLOR, THROUGHPUT_COLOR} from 'sentry/views/insights/colors';
import Chart, {
  ChartType,
  useSynchronizeCharts,
} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/insights/common/utils/constants';
import {useErrorRateQuery as useErrorCountQuery} from 'sentry/views/insights/common/views/spans/queries';
import {
  DataTitles,
  getDurationChartTitle,
  getThroughputChartTitle,
} from 'sentry/views/insights/common/views/spans/types';
import type {ModuleFilters} from 'sentry/views/insights/common/views/spans/useModuleFilters';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

const NULL_SPAN_CATEGORY = t('custom');

const {SPAN_SELF_TIME, SPAN_MODULE, SPAN_DESCRIPTION, SPAN_DOMAIN} = SpanMetricsField;

const CHART_HEIGHT = 140;

type Props = {
  appliedFilters: ModuleFilters;
  moduleName: ModuleName;
  eventView?: EventView;
  extraQuery?: string[];
  spanCategory?: string;
  throughputUnit?: RateUnit;
};

type ChartProps = {
  filters: ModuleFilters;
  moduleName: ModuleName;
  throughputUnit: RateUnit;
  extraQuery?: string[];
};

function getSegmentLabel(moduleName: ModuleName) {
  return moduleName === ModuleName.DB ? 'Queries' : 'Requests';
}

export function SpanTimeCharts({
  moduleName,
  appliedFilters,
  spanCategory,
  throughputUnit = RateUnit.PER_MINUTE,
  extraQuery,
}: Props) {
  const {selection} = usePageFilters();
  const {features} = useOrganization();

  const eventView = getEventView(moduleName, selection, appliedFilters, spanCategory);
  if (extraQuery) {
    eventView.query += ` ${extraQuery.join(' ')}`;
  }

  const {isPending} = useSpansQuery({
    eventView,
    initialData: [],
    referrer: 'api.starfish.span-time-charts',
  });

  useSynchronizeCharts(1, !isPending);

  const moduleCharts: Record<
    ModuleName,
    {
      Comp: (props: ChartProps) => JSX.Element;
      title: string;
    }[]
  > = {
    [ModuleName.DB]: [],
    [ModuleName.CACHE]: [],
    [ModuleName.VITAL]: [],
    [ModuleName.QUEUE]: [],
    [ModuleName.SCREEN_LOAD]: [],
    [ModuleName.APP_START]: [],
    [ModuleName.RESOURCE]: features.includes(
      'starfish-browser-resource-module-bundle-analysis'
    )
      ? [{title: DataTitles.bundleSize, Comp: BundleSizeChart}]
      : [],
    [ModuleName.HTTP]: [{title: DataTitles.errorCount, Comp: ErrorChart}],
    [ModuleName.AI]: [],
    [ModuleName.MOBILE_UI]: [],
    [ModuleName.MOBILE_SCREENS]: [],
    [ModuleName.SCREEN_RENDERING]: [],
    [ModuleName.OTHER]: [],
  };

  const charts = [
    {
      title: getThroughputChartTitle(moduleName, throughputUnit),
      Comp: ThroughputChart,
    },
    {
      title: getDurationChartTitle(moduleName),
      Comp: DurationChart,
    },
    ...moduleCharts[moduleName],
  ];

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

    let throughputMultiplier = 1; // We're fetching per minute, so default is 1
    if (throughputUnit === RateUnit.PER_SECOND) {
      throughputMultiplier = 1 / 60;
    } else if (throughputUnit === RateUnit.PER_HOUR) {
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
      loading={isPending}
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
      type={ChartType.LINE}
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
  );
}

function ErrorChart({moduleName, filters}: ChartProps): JSX.Element {
  const query = buildDiscoverQueryConditions(moduleName, filters);
  const {isPending, data} = useErrorCountQuery(query);

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
      chartColors={[ERRORS_COLOR]}
    />
  );
}

/** This fucntion is just to generate mock data based on other time stamps we have found */
const useMockSeries = ({moduleName, filters, extraQuery}: ChartProps) => {
  const pageFilters = usePageFilters();
  const eventView = getEventView(moduleName, pageFilters.selection, filters);
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
  const seriesTimes = avgSeries[0].data.map(({name}) => name);
  const assetTypes = ['javascript', 'css', 'fonts', 'images'];

  const mockData: Series[] = assetTypes.map(
    type =>
      ({
        seriesName: type,
        data: seriesTimes.map((time, i) => ({
          name: time,
          value: 1000 + Math.ceil(i / 100) * 100,
        })),
      }) satisfies Series
  );

  return {isPending, data: mockData};
};

function BundleSizeChart(props: ChartProps) {
  const {isPending, data} = useMockSeries(props);
  return (
    <Chart
      stacked
      type={ChartType.AREA}
      loading={isPending}
      data={data}
      aggregateOutputFormat="size"
      height={CHART_HEIGHT}
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

  if (moduleName !== ModuleName.RESOURCE) {
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
