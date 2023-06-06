import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import {Panel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';
import {PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useWrappedDiscoverTimeseriesQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {SpanGroupBreakdown} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdown';

export const OTHER_SPAN_GROUP_MODULE = 'Other';

type Props = {
  transaction?: string;
};

type Group = {
  'span.category': string;
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
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = pageFilter;
  const theme = useTheme();

  const {data: segments, isLoading: isSegmentsLoading} = useDiscoverQuery({
    eventView: getEventView(
      selection,
      // TODO: Fix has:span.category in the backend
      `has:span.category ${transaction ? `transaction:${transaction}` : ''}`,
      ['span.category']
    ),
    orgSlug: organization.slug,
    location,
    limit: 4,
  });

  const {data: cumulativeTime} = useDiscoverQuery({
    eventView: getEventView(
      selection,
      `${transaction ? `transaction:${transaction}` : ''}`,
      []
    ),
    orgSlug: organization.slug,
    location,
  });

  const {isLoading: isTopDataLoading, data: topData} = useWrappedDiscoverTimeseriesQuery({
    eventView: getEventView(
      selection,
      `has:span.category  ${transaction ? `transaction:${transaction}` : ''}`,
      ['span.category'],
      true
    ),
    initialData: [],
  });

  if (!segments?.data || !cumulativeTime?.data || topData.length === 0) {
    return <Placeholder height="200px" />;
  }

  const totalValues = cumulativeTime.data[0]['sum(span.duration)']
    ? parseInt(cumulativeTime?.data[0]['sum(span.duration)'] as string, 10)
    : 0;
  const totalSegments =
    segments?.data.reduce(
      (acc, segment) => acc + parseInt(segment['sum(span.duration)'] as string, 10),
      0
    ) ?? 0;

  const otherValue = totalValues ? totalValues - totalSegments : 0;

  const transformedData: DataRow[] = [];

  for (let index = 0; index < segments.data.length; index++) {
    const element = segments.data[index];
    transformedData.push({
      cumulativeTime: parseInt(element['sum(span.duration)'] as string, 10),
      group: {
        'span.category': element['span.category'] as string,
      },
    });
  }

  if (otherValue > 0) {
    transformedData.push({
      cumulativeTime: otherValue,
      group: {
        'span.category': OTHER_SPAN_GROUP_MODULE,
      },
    });
  }

  const seriesByDomain: {[category: string]: Series} = {};
  const colorPalette = theme.charts.getColorPalette(transformedData.length - 2);

  if (!isTopDataLoading && topData.length > 0 && transformedData.length > 0) {
    transformedData.forEach((segment, index) => {
      const label = segment.group['span.category'];
      seriesByDomain[label] = {
        seriesName: `${label}`,
        data: [],
        color: colorPalette[index],
      };
    });

    topData.forEach(value => {
      seriesByDomain[value.group].data.push({
        value: value['p95(span.duration)'],
        name: value.interval,
      });
    });
  }

  const data = Object.values(seriesByDomain);

  const initialShowSeries = transformedData.map(
    segment => segment.group['span.category'] !== OTHER_SPAN_GROUP_MODULE
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
    orderby: '-sum_span_duration',
    projects: [1],
    version: 2,
    topEvents: groups.length > 0 ? '4' : undefined,
    interval: getTimeseries ? getInterval(pageFilters.datetime, 'low') : undefined,
  });
};
