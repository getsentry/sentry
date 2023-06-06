import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ERRORS_COLOR, P95_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import {getSegmentLabel} from 'sentry/views/starfish/components/breakdownBar';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {ModuleName} from 'sentry/views/starfish/types';
import {
  datetimeToClickhouseFilterTimestamps,
  getDateFilters,
} from 'sentry/views/starfish/utils/dates';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {useErrorRateQuery as useErrorCountQuery} from 'sentry/views/starfish/views/spans/queries';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Props = {
  appliedFilters: AppliedFilters;
  moduleName: ModuleName;
};

type AppliedFilters = {
  action: string;
  domain: string;
  group_id: string;
  span_operation: string;
};

type ChartProps = {
  filters: AppliedFilters;
  moduleName: ModuleName;
};

export function SpanTimeCharts({moduleName, appliedFilters}: Props) {
  const {selection} = usePageFilters();
  const location = useLocation();

  const eventView = getEventView(moduleName, location, selection, appliedFilters);

  const {isLoading} = useSpansQuery({
    eventView,
    queryString: `${getQuery(
      moduleName,
      selection,
      appliedFilters
    )}&referrer=span-time-charts`,
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

  const charts = [...moduleCharts[ModuleName.ALL], ...moduleCharts[moduleName]];

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
  const query = getQuery(moduleName, pageFilters.selection, filters);
  const eventView = getEventView(moduleName, location, pageFilters.selection, filters);
  const {startTime, endTime} = getDateFilters(pageFilters);
  const {span_operation, action, domain} = location.query;

  const label = getSegmentLabel(span_operation, action, domain);
  const {isLoading, data} = useSpansQuery({
    eventView,
    queryString: `${query}&referrer=span-time-charts`,
    initialData: [],
  });
  const dataByGroup = {[label]: data};

  const throughputTimeSeries = Object.keys(dataByGroup).map(groupName => {
    const groupData = dataByGroup[groupName];

    return zeroFillSeries(
      {
        seriesName: label ?? 'Throughput',
        data: groupData.map(datum => ({
          value: datum['spm()'] / 60,
          name: datum.interval,
        })),
      },
      moment.duration(1, 'day'),
      startTime,
      endTime
    );
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
      stacked
      isLineChart
      chartColors={[THROUGHPUT_COLOR]}
      tooltipFormatterOptions={{
        valueFormatter: value => `${value.toFixed(3)} / ${t('sec')}`,
      }}
    />
  );
}

function DurationChart({moduleName, filters}: ChartProps): JSX.Element {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const query = getQuery(moduleName, pageFilters.selection, filters);
  const eventView = getEventView(moduleName, location, pageFilters.selection, filters);
  const {startTime, endTime} = getDateFilters(pageFilters);
  const {span_operation, action, domain} = location.query;

  const label = getSegmentLabel(span_operation, action, domain);

  const {isLoading, data} = useSpansQuery({
    eventView,
    queryString: `${query}&referrer=span-time-charts`,
    initialData: [],
  });
  const dataByGroup = {[label]: data};

  const p95Series = Object.keys(dataByGroup).map(groupName => {
    const groupData = dataByGroup[groupName];

    return zeroFillSeries(
      {
        seriesName: label ?? 'p95()',
        data: groupData.map(datum => ({
          value: datum['p95(span.duration)'],
          name: datum.interval,
        })),
      },
      moment.duration(1, 'day'),
      startTime,
      endTime
    );
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

const getQuery = (
  moduleName: ModuleName,
  pageFilters: PageFilters,
  appliedFilters: AppliedFilters
) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(
    pageFilters.datetime
  );

  const conditions = buildSQLQueryConditions(moduleName, appliedFilters);

  return `SELECT
    divide(count(), multiply(12, 60)) as "spm()",
    quantile(0.50)(exclusive_time) AS "p50(span.duration)",
    quantile(0.95)(exclusive_time) AS "p95(span.duration)",
    toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
    FROM spans_experimental_starfish
    WHERE greaterOrEquals(start_timestamp, '${start_timestamp}')
    ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
    ${conditions ? `AND ${conditions}` : ''}
    GROUP BY interval
    ORDER BY interval ASC
  `;
};

const SPAN_FILTER_KEYS = ['span_operation', 'domain', 'action'];

const buildSQLQueryConditions = (
  moduleName: ModuleName,
  appliedFilters: AppliedFilters
) => {
  const result = Object.keys(appliedFilters)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .filter(key => Boolean(appliedFilters[key]))
    .map(key => {
      return `${key} = '${appliedFilters[key]}'`;
    });

  if (moduleName !== ModuleName.ALL) {
    result.push(`module = '${moduleName}'`);
  }

  return result.join(' ');
};

const getEventView = (
  moduleName: ModuleName,
  location: Location,
  pageFilters: PageFilters,
  appliedFilters: AppliedFilters
) => {
  const query = buildDiscoverQueryConditions(moduleName, appliedFilters);

  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      fields: [''],
      yAxis: ['spm()', 'p50(span.duration)', 'p95(span.duration)'],
      query,
      dataset: DiscoverDatasets.SPANS_METRICS,
      projects: [1],
      interval: getInterval(pageFilters.datetime, 'low'),
      version: 2,
    },
    location
  );
};

const buildDiscoverQueryConditions = (
  moduleName: ModuleName,
  appliedFilters: AppliedFilters
) => {
  const result = Object.keys(appliedFilters)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .filter(key => Boolean(appliedFilters[key]))
    .map(key => {
      return `${key}:${appliedFilters[key]}`;
    });

  if (moduleName !== ModuleName.ALL) {
    result.push(`span.module:${moduleName}`);
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
