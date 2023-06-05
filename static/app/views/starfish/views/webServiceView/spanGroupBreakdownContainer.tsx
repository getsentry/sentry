import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import {getInterval} from 'sentry/components/charts/utils';
import {Panel} from 'sentry/components/panels';
import {space} from 'sentry/styles/space';
import {PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {
  getOtherModulesTimeseries,
  getTopModules,
  getTopModulesTimeseries,
  totalCumulativeTime,
} from 'sentry/views/starfish/views/webServiceView/queries';
import {SpanGroupBreakdown} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdown';

export const OTHER_SPAN_GROUP_MODULE = 'other';
const FORCE_USE_DISCOVER = true;

type Props = {
  transaction?: string;
};

type Group = {
  'span.module': string;
};

export type Segment = Group & {
  'p95(span.duration)': number;
  'sum(span.duration)': number;
};

export type DataRow = {
  cumulativeTime: number;
  group: Group;
};

export function SpanGroupBreakdownContainer({transaction: maybeTransaction}: Props) {
  const transaction = maybeTransaction ?? '';
  const pageFilter = usePageFilters();
  const {selection} = pageFilter;
  const theme = useTheme();

  const {data: segments, isLoading: isSegmentsLoading} = useSpansQuery<Segment[]>({
    queryString: `${getTopModules({
      transaction,
      datetime: selection.datetime,
    })}`,
    eventView: getEventView(
      selection,
      `span.module:[db,http] ${transaction ? `transaction:${transaction}` : ''}`,
      ['span.module']
    ),
    initialData: [],
    forceUseDiscover: FORCE_USE_DISCOVER,
  });

  const {data: cumulativeTime} = useSpansQuery({
    queryString: `${totalCumulativeTime({
      transaction,
      datetime: selection.datetime,
    })}`,
    eventView: getEventView(
      selection,
      `${transaction ? `transaction:${transaction}` : ''}`,
      []
    ),
    initialData: [],
    forceUseDiscover: FORCE_USE_DISCOVER,
  });

  const totalValues = cumulativeTime.reduce(
    (acc, segment) => acc + segment['sum(span.duration)'],
    0
  );
  const totalSegments = segments.reduce(
    (acc, segment) => acc + segment['sum(span.duration)'],
    0
  );
  const otherValue = totalValues - totalSegments;

  const transformedData: DataRow[] = [];

  for (let index = 0; index < segments.length; index++) {
    const element = segments[index];
    transformedData.push({
      cumulativeTime: element['sum(span.duration)'],
      group: {
        'span.module': element['span.module'],
      },
    });
  }

  transformedData.push({
    cumulativeTime: otherValue,
    group: {
      'span.module': OTHER_SPAN_GROUP_MODULE,
    },
  });

  let topConditions =
    segments.length > 0 ? ` span.module = '${segments[0]['span.module']}'` : '';

  for (let index = 1; index < segments.length; index++) {
    const element = segments[index];
    topConditions = topConditions.concat(
      ' OR ',
      ` span.module = '${element['span.module']}'`
    );
  }

  const {isLoading: isTopDataLoading, data: topData} = useSpansQuery({
    queryString: `${getTopModulesTimeseries({
      transaction,
      topConditions,
      datetime: selection.datetime,
    })}`,
    eventView: getEventView(
      selection,
      `span.module:[db,http] ${transaction ? `transaction:${transaction}` : ''}`,
      ['span.module'],
      true
    ),
    initialData: [],
    forceUseDiscover: FORCE_USE_DISCOVER,
  });

  const {isLoading: isOtherDataLoading, data: otherData} = useSpansQuery({
    queryString: `${getOtherModulesTimeseries({
      transaction,
      topConditions,
      datetime: selection.datetime,
    })}`,
    eventView: getEventView(
      selection,
      `!span.module:[db,http] ${transaction ? `transaction:${transaction}` : ''}`,
      [],
      true
    ),
    initialData: [],
    forceUseDiscover: FORCE_USE_DISCOVER,
  });

  const seriesByDomain: {[module: string]: Series} = {};
  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const start =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const end = moment(pageFilter.selection.datetime.end ?? undefined);

  const colorPalette = theme.charts.getColorPalette(transformedData.length - 3);

  if (
    !isTopDataLoading &&
    !isOtherDataLoading &&
    topData.length > 0 &&
    segments.length > 0
  ) {
    segments.forEach((segment, index) => {
      const label = segment['span.module'];
      seriesByDomain[label] = {
        seriesName: `${label}`,
        data: [],
        color: colorPalette[index],
      };
    });

    topData.forEach(value => {
      seriesByDomain[value['span.module'] ?? value.group].data.push({
        value: value['p95(span.duration)'],
        name: value.interval,
      });
    });

    seriesByDomain.Other = {
      seriesName: `Other`,
      data: [],
      color: theme.gray100,
    };

    otherData.forEach(value => {
      seriesByDomain.Other.data.push({
        value: value['p95(span.duration)'],
        name: value.interval,
      });
    });
  }

  const data = Object.values(seriesByDomain).map(series =>
    zeroFillSeries(series, moment.duration(12, 'hour'), start, end)
  );

  const initialShowSeries = transformedData.map(
    segment => segment.group['span.module'] !== OTHER_SPAN_GROUP_MODULE
  );

  return (
    <StyledPanel>
      <SpanGroupBreakdown
        tableData={transformedData}
        totalCumulativeTime={totalValues}
        isTableLoading={isSegmentsLoading}
        topSeriesData={data}
        colorPalette={colorPalette}
        initialShowSeries={initialShowSeries}
      />
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  padding-top: ${space(2)};
  margin-bottom: 0;
`;

const getEventView = (
  pageFilters: PageFilters,
  query: string,
  groups: string[],
  getTimeseries?: boolean
) => {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['sum(span.duration)', 'p95(span.duration)', ...groups],
    yAxis: getTimeseries ? ['sum(span.duration)', 'p95(span.duration)'] : [],
    query,
    dataset: DiscoverDatasets.SPANS_METRICS,
    start: pageFilters.datetime.start ?? undefined,
    end: pageFilters.datetime.end ?? undefined,
    range: pageFilters.datetime.period ?? undefined,
    projects: [1],
    version: 2,
    topEvents: groups.length > 0 ? '5' : undefined,
    interval: getTimeseries ? getInterval(pageFilters.datetime, 'low') : undefined,
  });
};
