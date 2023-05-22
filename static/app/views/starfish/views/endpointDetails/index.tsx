import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment';
import * as qs from 'query-string';

import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import Detail from 'sentry/views/starfish/components/detailPanel';
import {
  OverflowEllipsisTextContainer,
  renderHeadCell,
  TextAlignLeft,
} from 'sentry/views/starfish/modules/APIModule/endpointTable';
import {
  getEndpointDetailSeriesQuery,
  getEndpointDetailTableEventView,
  getEndpointDetailTableQuery,
} from 'sentry/views/starfish/modules/APIModule/queries';
import {useQueryTransactionByTPMAndDuration} from 'sentry/views/starfish/modules/databaseModule/queries';
import {queryToSeries} from 'sentry/views/starfish/modules/databaseModule/utils';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

export type EndpointDataRow = {
  count: number;
  description: string;
  domain: string;
  failure_count: number;
  failure_rate: number;
  group_id: string;
  'p50(exclusive_time)': number;
  'p95(exclusive_time)': number;
  transaction_count: number;
};

export type SpanTransactionDataRow = {
  count: number;
  transaction: string;
};

type EndpointDetailBodyProps = {
  row: EndpointDataRow;
};

const COLUMN_ORDER = [
  {
    key: 'transaction',
    name: 'Transaction',
    width: 280,
  },
  {
    key: 'count()',
    name: 'Count',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p50(span.self_time)',
    name: 'p50',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'failure_rate',
    name: 'Error %',
    width: COL_WIDTH_UNDEFINED,
  },
];
export default function EndpointDetail({
  row,
  onClose,
}: Partial<EndpointDetailBodyProps> & {onClose: () => void}) {
  return (
    <Detail detailKey={row?.description} onClose={onClose}>
      {row && <EndpointDetailBody row={row} />}
    </Detail>
  );
}

function EndpointDetailBody({row}: EndpointDetailBodyProps) {
  const pageFilter = usePageFilters();
  const location = useLocation();
  const seriesQuery = getEndpointDetailSeriesQuery({
    description: null,
    transactionName: null,
    datetime: pageFilter.selection.datetime,
    groupId: row.group_id,
  });
  const {isLoading: seriesIsLoading, data: seriesData} = useQuery({
    queryKey: [seriesQuery],
    queryFn: () => fetch(`${HOST}/?query=${seriesQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {isLoading: tableIsLoading, data: tableData} = useSpansQuery({
    queryString: getEndpointDetailTableQuery({
      description: null,
      transactionName: null,
      datetime: pageFilter.selection.datetime,
      groupId: row.group_id,
    }),
    eventView: getEndpointDetailTableEventView({
      description: null,
      transactionName: null,
      datetime: pageFilter.selection.datetime,
      groupId: row.group_id,
    }),
    initialData: [],
  });

  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const endTime = moment(pageFilter.selection.datetime.end ?? undefined);

  const [p50Series, p95Series, countSeries, _errorCountSeries, errorRateSeries] =
    endpointDetailDataToChartData(seriesData).map(series =>
      zeroFillSeries(series, moment.duration(12, 'hours'), startTime, endTime)
    );

  const {isLoading: isP75GraphLoading, data: transactionGraphData} =
    useQueryTransactionByTPMAndDuration(
      tableData.map(d => d.transaction).splice(0, 5),
      24
    );

  const tpmTransactionSeries = queryToSeries(
    transactionGraphData,
    'group',
    'epm()',
    startTime,
    endTime,
    24
  );

  const p50TransactionSeries = queryToSeries(
    transactionGraphData,
    'group',
    'p50(transaction.duration)',
    startTime,
    endTime,
    24
  );

  return (
    <div>
      <h2>{t('Endpoint Detail')}</h2>
      <p>
        {t(
          'Detailed summary of http client spans. Detailed summary of http client spans. Detailed summary of http client spans. Detailed summary of http client spans. Detailed summary of http client spans. Detailed summary of http client spans.'
        )}
      </p>
      <SubHeader>{t('Endpoint URL')}</SubHeader>
      <pre>{row?.description}</pre>
      <SubHeader>{t('Domain')}</SubHeader>
      <pre>{row?.domain}</pre>
      <FlexRowContainer>
        <FlexRowItem>
          <SubHeader>{t('Duration (P50)')}</SubHeader>
          <SubSubHeader>
            <Duration
              seconds={row['p50(span.self_time)'] / 1000}
              fixedDigits={2}
              abbreviation
            />
          </SubSubHeader>
          <APIDetailChart
            series={p50Series}
            isLoading={seriesIsLoading}
            index={2}
            outOf={4}
          />
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>{t('Duration (P95)')}</SubHeader>
          <SubSubHeader>
            <Duration
              seconds={row['p95(span.self_time)'] / 1000}
              fixedDigits={2}
              abbreviation
            />
          </SubSubHeader>
          <APIDetailChart
            series={p95Series}
            isLoading={seriesIsLoading}
            index={3}
            outOf={4}
          />
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>{t('Throughput')}</SubHeader>
          <SubSubHeader>{row.count}</SubSubHeader>
          <APIDetailChart
            series={countSeries}
            isLoading={seriesIsLoading}
            index={0}
            outOf={4}
          />
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>{t('Error Rate')}</SubHeader>
          <SubSubHeader>{row.failure_rate}</SubSubHeader>
          <APIDetailChart
            series={errorRateSeries}
            isLoading={seriesIsLoading}
            index={1}
            outOf={4}
          />
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>{t('Top 5 Transaction Throughput')}</SubHeader>
          <APIDetailChart series={tpmTransactionSeries} isLoading={isP75GraphLoading} />
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>{t('Top 5 Transaction P75')}</SubHeader>
          <APIDetailChart series={p50TransactionSeries} isLoading={isP75GraphLoading} />
        </FlexRowItem>
      </FlexRowContainer>
      <GridEditable
        isLoading={tableIsLoading}
        data={tableData}
        columnOrder={COLUMN_ORDER}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell: (column: GridColumnHeader, dataRow: SpanTransactionDataRow) =>
            renderBodyCell(column, dataRow, row.group_id),
        }}
        location={location}
      />
    </div>
  );
}

// TODO: A lot of this is duplicate from endpointTable.tsx renderBodyCell.
// Only difference is the links. Come up with a better way to share this.
function renderBodyCell(
  column: GridColumnHeader,
  row: SpanTransactionDataRow,
  groupId: string
): React.ReactNode {
  if (column.key === 'transaction') {
    return (
      <OverflowEllipsisTextContainer>
        <Link
          to={`/starfish/span/${groupId}?${qs.stringify({transaction: row.transaction})}`}
        >
          {row[column.key]}
        </Link>
      </OverflowEllipsisTextContainer>
    );
  }

  if (column.key.toString().match(/^p\d\d/)) {
    return (
      <TextAlignLeft>
        <Duration seconds={row[column.key] / 1000} fixedDigits={2} abbreviation />
      </TextAlignLeft>
    );
  }
  if (!['description', 'transaction'].includes(column.key.toString())) {
    return (
      <TextAlignLeft>
        <OverflowEllipsisTextContainer>{row[column.key]}</OverflowEllipsisTextContainer>
      </TextAlignLeft>
    );
  }

  return <OverflowEllipsisTextContainer>{row[column.key]}</OverflowEllipsisTextContainer>;
}

function endpointDetailDataToChartData(data: any) {
  const series = [] as any[];
  if (data.length > 0) {
    Object.keys(data[0])
      .filter(key => key !== 'interval')
      .forEach(key => {
        series.push({seriesName: `${key}()`, data: [] as any[]});
      });
  }
  data.forEach(point => {
    Object.keys(point).forEach(key => {
      if (key !== 'interval') {
        series
          .find(serie => serie.seriesName === `${key}()`)
          ?.data.push({
            name: point.interval,
            value: point[key],
          });
      }
    });
  });
  return series;
}

function APIDetailChart(props: {
  isLoading: boolean;
  series: any;
  index?: number;
  outOf?: number;
}) {
  const theme = useTheme();
  return (
    <Chart
      statsPeriod="24h"
      height={110}
      data={
        Array.isArray(props.series) ? props.series : props.series ? [props.series] : []
      }
      start=""
      end=""
      loading={props.isLoading}
      utc={false}
      stacked
      isLineChart
      disableXAxis
      hideYAxisSplitLine
      chartColors={
        props.index && props.outOf
          ? [theme.charts.getColorPalette(props.outOf - 2)[props.index]]
          : undefined
      }
      grid={{
        left: '0',
        right: '0',
        top: '8px',
        bottom: '16px',
      }}
    />
  );
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  margin-bottom: ${space(1)};
`;

const SubSubHeader = styled('h4')`
  margin: 0;
  font-weight: normal;
`;

const FlexRowContainer = styled('div')`
  display: flex;
  & > div:last-child {
    padding-right: ${space(1)};
  }
  flex-wrap: wrap;
`;

const FlexRowItem = styled('div')`
  padding-right: ${space(4)};
  flex: 1;
  flex-grow: 0;
  min-width: 280px;
  & > h3 {
    margin-bottom: 0;
  }
`;
