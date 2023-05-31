import styled from '@emotion/styled';
import moment from 'moment';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageFilters} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DURATION_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import {getSegmentLabel} from 'sentry/views/starfish/components/breakdownBar';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {ModuleName} from 'sentry/views/starfish/types';
import {
  datetimeToClickhouseFilterTimestamps,
  PERIOD_REGEX,
} from 'sentry/views/starfish/utils/dates';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

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

export function SpanTimeCharts({moduleName, appliedFilters}: Props) {
  const location = useLocation();

  const {selection} = usePageFilters();
  const [_, num, unit] = selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(selection.datetime.start);
  const endTime = moment(selection.datetime.end ?? undefined);

  const query = getQuery(moduleName, selection, appliedFilters);
  const eventView = getEventView(moduleName, selection, appliedFilters);

  const {isLoading, data} = useSpansQuery({
    eventView,
    queryString: `${query}&referrer=span-time-charts`,
    initialData: [],
  });

  const {span_operation, action, domain} = location.query;

  const label = getSegmentLabel(span_operation, action, domain);
  const dataByGroup = {[label]: data};

  const throughputTimeSeries = Object.keys(dataByGroup).map(groupName => {
    const groupData = dataByGroup[groupName];

    return zeroFillSeries(
      {
        seriesName: label ?? 'Throughput',
        data: groupData.map(datum => ({
          value: datum['spm()'],
          name: datum.interval,
        })),
      },
      moment.duration(1, 'day'),
      startTime,
      endTime
    );
  });

  const p50Series = Object.keys(dataByGroup).map(groupName => {
    const groupData = dataByGroup[groupName];

    return zeroFillSeries(
      {
        seriesName: label ?? 'p50()',
        data: groupData.map(datum => ({
          value: datum['p50(span.duration)'],
          name: datum.interval,
        })),
      },
      moment.duration(1, 'day'),
      startTime,
      endTime
    );
  });

  useSynchronizeCharts([!isLoading]);

  return (
    <ChartsContainer>
      <ChartsContainerItem>
        <ChartPanel title={t('Throughput')}>
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
            disableXAxis
            tooltipFormatterOptions={{
              valueFormatter: value => `${value.toFixed(3)} / ${t('min')}`,
            }}
          />
        </ChartPanel>
      </ChartsContainerItem>

      <ChartsContainerItem>
        <ChartPanel title={t('Duration (P50)')}>
          <Chart
            statsPeriod="24h"
            height={100}
            data={p50Series}
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
            chartColors={[DURATION_COLOR]}
            disableXAxis
          />
        </ChartPanel>
      </ChartsContainerItem>
    </ChartsContainer>
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
  pageFilters: PageFilters,
  appliedFilters: AppliedFilters
) => {
  const query = buildDiscoverQueryConditions(moduleName, appliedFilters);

  return EventView.fromSavedQuery({
    name: '',
    fields: [''],
    yAxis: ['spm()', 'p50(span.duration)'],
    query,
    dataset: DiscoverDatasets.SPANS_METRICS,
    start: pageFilters.datetime.start ?? undefined,
    end: pageFilters.datetime.end ?? undefined,
    range: pageFilters.datetime.period ?? undefined,
    projects: [1],
    version: 2,
  });
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
    result.push(`span.module:'${moduleName}'`);
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
