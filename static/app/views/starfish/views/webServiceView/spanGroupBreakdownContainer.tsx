import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import {Panel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getSegmentLabel} from 'sentry/views/starfish/components/breakdownBar';
import {PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {
  getOtherDomainsActionsAndOpTimeseries,
  getTopDomainsActionsAndOp,
  getTopDomainsActionsAndOpTimeseries,
  totalCumulativeTime,
} from 'sentry/views/starfish/views/webServiceView/queries';
import {SpanGroupBreakdown} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdown';

const HOST = 'http://localhost:8080';

export const OTHER_SPAN_GROUP_MODULE = 'other';

type Props = {
  transaction?: string;
};

type Group = {
  action: string;
  domain: string;
  module: string;
  span_operation: string;
  transaction?: string;
};

export type Segment = Group & {
  num_spans: number;
  sum: number;
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

  const {data: segments, isLoading: isSegmentsLoading} = useQuery<Segment[]>({
    queryKey: ['webServiceSpanGrouping', transaction, selection.datetime],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getTopDomainsActionsAndOp({
          transaction,
          datetime: selection.datetime,
        })}`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {data: cumulativeTime} = useQuery({
    queryKey: ['totalCumulativeTime', transaction, selection.datetime],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${totalCumulativeTime({
          transaction,
          datetime: selection.datetime,
        })}`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const totalValues = cumulativeTime.reduce((acc, segment) => acc + segment.sum, 0);
  const totalSegments = segments.reduce((acc, segment) => acc + segment.sum, 0);
  const otherValue = totalValues - totalSegments;

  const transformedData: DataRow[] = [];

  for (let index = 0; index < segments.length; index++) {
    const element = segments[index];
    transformedData.push({
      cumulativeTime: element.sum,
      group: {
        action: element.action,
        domain: element.domain,
        module: element.module,
        span_operation: element.span_operation,
        transaction: element.transaction,
      },
    });
  }

  transformedData.push({
    cumulativeTime: otherValue,
    group: {
      action: '',
      domain: '',
      module: OTHER_SPAN_GROUP_MODULE,
      span_operation: 'Other',
      transaction: '',
    },
  });

  let topConditions =
    segments.length > 0
      ? ` (span_operation = '${segments[0].span_operation}' ${
          segments[0].action ? `AND action = '${segments[0].action}'` : ''
        } ${segments[0].domain ? `AND domain = '${segments[0].domain}'` : ''})`
      : '';

  for (let index = 1; index < segments.length; index++) {
    const element = segments[index];
    topConditions = topConditions.concat(
      ' OR ',
      `(span_operation = '${element.span_operation}' ${
        element.action ? `AND action = '${element.action}'` : ''
      } ${element.domain ? `AND domain = '${element.domain}'` : ''})`
    );
  }

  const {isLoading: isTopDataLoading, data: topData} = useQuery({
    queryKey: ['topSpanGroupTimeseries', transaction, topConditions, selection.datetime],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getTopDomainsActionsAndOpTimeseries({
          transaction,
          topConditions,
          datetime: selection.datetime,
        })}`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {isLoading: isOtherDataLoading, data: otherData} = useQuery({
    queryKey: [
      'otherSpanGroupTimeseries',
      transaction,
      topConditions,
      selection.datetime,
    ],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getOtherDomainsActionsAndOpTimeseries({
          transaction,
          topConditions,
          datetime: selection.datetime,
        })}`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const seriesByDomain: {[module: string]: Series} = {};
  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const start =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const end = moment(pageFilter.selection.datetime.end ?? undefined);

  const colorPalette = theme.charts.getColorPalette(transformedData.length - 3);

  if (!isTopDataLoading && !isOtherDataLoading && segments.length > 0) {
    segments.forEach((segment, index) => {
      const label = getSegmentLabel(
        segment.span_operation,
        segment.action,
        segment.domain
      );
      seriesByDomain[label] = {
        seriesName: `${label}`,
        data: [],
        color: colorPalette[index],
      };
    });

    topData.forEach(value => {
      seriesByDomain[
        getSegmentLabel(value.span_operation, value.action, value.domain)
      ].data.push({value: value.p50, name: value.interval});
    });

    seriesByDomain.Other = {
      seriesName: `Other`,
      data: [],
      color: theme.gray100,
    };

    otherData.forEach(value => {
      seriesByDomain.Other.data.push({value: value.p50, name: value.interval});
    });
  }

  const data = Object.values(seriesByDomain).map(series =>
    zeroFillSeries(series, moment.duration(12, 'hour'), start, end)
  );

  const initialShowSeries = transformedData.map(
    segment => segment.group.module !== OTHER_SPAN_GROUP_MODULE
  );

  if (isTopDataLoading || isSegmentsLoading) {
    return (
      <Panel>
        <Placeholder height="600px" />
      </Panel>
    );
  }

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
