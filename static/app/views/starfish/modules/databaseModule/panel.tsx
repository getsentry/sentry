import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import keyBy from 'lodash/keyBy';
import merge from 'lodash/merge';
import values from 'lodash/values';
import moment from 'moment';
import * as qs from 'query-string';

import Badge from 'sentry/components/badge';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import Detail from 'sentry/views/starfish/components/detailPanel';
import {
  getPanelEventCount,
  getPanelGraphQuery,
  getPanelTableQuery,
} from 'sentry/views/starfish/modules/databaseModule/queries';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

import {DataRow} from './databaseTableView';

const INTERVAL = 12;
const HOST = 'http://localhost:8080';

type EndpointDetailBodyProps = {
  isDataLoading: boolean;
  onRowChange: (row: DataRow | undefined) => void;
  row: DataRow;
  nextRow?: DataRow;
  prevRow?: DataRow;
};

type TransactionListDataRow = {
  count: number;
  group_id: string;
  p75: number;
  transaction: string;
  uniqueEvents: number;
};

const COLUMN_ORDER = [
  {
    key: 'transaction',
    name: 'Transaction',
    width: 400,
  },
  {
    key: 'p75',
    name: 'p75',
  },
  {
    key: 'count',
    name: 'Count',
  },
  {
    key: 'frequency',
    name: 'Frequency',
  },
  {
    key: 'uniqueEvents',
    name: 'Total Events',
  },
];

export default function QueryDetail({
  row,
  nextRow,
  prevRow,
  isDataLoading,
  onClose,
  onRowChange,
}: Partial<EndpointDetailBodyProps> & {
  isDataLoading: boolean;
  onClose: () => void;
  onRowChange: (row: DataRow) => void;
}) {
  return (
    <Detail detailKey={row?.description} onClose={onClose}>
      {row && (
        <QueryDetailBody
          onRowChange={onRowChange}
          isDataLoading={isDataLoading}
          row={row}
          nextRow={nextRow}
          prevRow={prevRow}
        />
      )}
    </Detail>
  );
}

function formatRow(description, queryDetail) {
  let acc = '';
  return description.split('').map((token, i) => {
    acc += token;
    let final: string | React.ReactElement | null = null;
    if (acc === queryDetail.action) {
      final = <Operation key={i}>{queryDetail.action} </Operation>;
    } else if (acc === queryDetail.domain) {
      final = <Domain key={i}>{queryDetail.domain} </Domain>;
    } else if (
      ['FROM', 'INNER', 'JOIN', 'WHERE', 'ON', 'AND', 'NOT', 'NULL', 'IS'].includes(acc)
    ) {
      final = <Keyword key={i}>{acc}</Keyword>;
    } else if (['(', ')'].includes(acc)) {
      final = <Bracket key={i}>{acc}</Bracket>;
    } else if (token === ' ' || token === '\n' || description[i + 1] === ')') {
      final = acc;
    } else if (i === description.length - 1) {
      final = acc;
    }
    if (final) {
      acc = '';
      const result = final;
      final = null;
      return result;
    }
    return null;
  });
}

function QueryDetailBody({
  row,
  nextRow,
  prevRow,
  onRowChange,
  isDataLoading: isRowLoading,
}: EndpointDetailBodyProps) {
  const theme = useTheme();
  const location = useLocation();
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const DATE_FILTERS = `
    greater(start_timestamp, fromUnixTimestamp(${startTime.unix()})) and
    less(start_timestamp, fromUnixTimestamp(${endTime.unix()}))
  `;

  const {isLoading, data: graphData} = useQuery({
    queryKey: ['dbQueryDetailsGraph', row.group_id, pageFilter.selection.datetime],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getPanelGraphQuery(DATE_FILTERS, row, INTERVAL)}&format=sql`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {isLoading: isTableLoading, data: tableData} = useQuery<TransactionListDataRow[]>(
    {
      queryKey: ['dbQueryDetailsTable', row.group_id, pageFilter.selection.datetime],
      queryFn: () =>
        fetch(`${HOST}/?query=${getPanelTableQuery(DATE_FILTERS, row)}`).then(res =>
          res.json()
        ),
      retry: true,
      initialData: [],
    }
  );

  const {isLoading: isEventCountLoading, data: eventCountData} = useQuery({
    queryKey: ['dbQueryDetailsEventCount', row.group_id, pageFilter.selection.datetime],
    queryFn: () =>
      fetch(`${HOST}/?query=${getPanelEventCount(DATE_FILTERS, row)}`).then(res =>
        res.json()
      ),
    retry: true,
    initialData: [],
  });

  const isDataLoading =
    isLoading || isTableLoading || isEventCountLoading || isRowLoading;
  let avgP75 = 0;
  if (!isDataLoading) {
    avgP75 =
      tableData.reduce((acc, transaction) => acc + transaction.p75, 0) / tableData.length;
  }

  const mergedTableData = values(
    merge(keyBy(eventCountData, 'transaction'), keyBy(tableData, 'transaction'))
  ).filter((data: Partial<TransactionListDataRow>) => !!data.count && !!data.p75);

  const [countSeries, p75Series] = throughputQueryToChartData(
    graphData,
    startTime,
    endTime
  );

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    return <span>{column.name}</span>;
  }

  const renderBodyCell = (
    column: GridColumnHeader,
    dataRow: TransactionListDataRow
  ): React.ReactNode => {
    if (column.key === 'frequency') {
      return <span>{(dataRow.count / dataRow.uniqueEvents).toFixed(2)}</span>;
    }
    const {key} = column;
    const value = dataRow[key];
    if (key === 'transaction') {
      return (
        <Link
          to={`/starfish/span/${encodeURIComponent(row.group_id)}?${qs.stringify({
            transaction: dataRow.transaction,
          })}`}
        >
          {dataRow[column.key]}
        </Link>
      );
    }
    if (key === 'p75') {
      const p75threshold = 1.5 * avgP75;
      return (
        <span style={value > p75threshold ? {color: theme.red400} : {}}>
          {value?.toFixed(2)}ms
        </span>
      );
    }
    return <span>{value}</span>;
  };

  return (
    <div>
      <Paginator>
        <SimplePagination
          disableLeft={!prevRow}
          disableRight={!nextRow}
          onLeftClick={() => onRowChange(prevRow)}
          onRightClick={() => onRowChange(nextRow)}
        />
      </Paginator>
      <h2>{t('Query Detail')}</h2>
      <FlexRowContainer>
        <FlexRowItem>
          <SubHeader>
            {t('First Seen')}
            {row.newish === 1 && <Badge type="new" text="new" />}
          </SubHeader>
          <SubSubHeader>{row.firstSeen}</SubSubHeader>
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>
            {t('Last Seen')}
            {row.retired === 1 && <Badge type="warning" text="old" />}
          </SubHeader>
          <SubSubHeader>{row.lastSeen}</SubSubHeader>
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>{t('Total Time')}</SubHeader>
          <SubSubHeader>{row.total_time.toFixed(2)}ms</SubSubHeader>
        </FlexRowItem>
      </FlexRowContainer>
      <SubHeader>{t('Query Description')}</SubHeader>
      <FormattedCode>{formatRow(row.formatted_desc, row)}</FormattedCode>
      <FlexRowContainer>
        <FlexRowItem>
          <SubHeader>{t('Throughput')}</SubHeader>
          <SubSubHeader>{row.epm.toFixed(3)}</SubSubHeader>
          <Chart
            statsPeriod="24h"
            height={140}
            data={[countSeries]}
            start=""
            end=""
            loading={isDataLoading}
            utc={false}
            disableMultiAxis
            stacked
            isLineChart
            disableXAxis
            hideYAxisSplitLine
          />
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>{t('Duration (P75)')}</SubHeader>
          <SubSubHeader>{row.p75.toFixed(3)}ms</SubSubHeader>
          <Chart
            statsPeriod="24h"
            height={140}
            data={[p75Series]}
            start=""
            end=""
            loading={isDataLoading}
            utc={false}
            chartColors={[theme.charts.getColorPalette(4)[3]]}
            disableMultiAxis
            stacked
            isLineChart
            disableXAxis
            hideYAxisSplitLine
          />
        </FlexRowItem>
      </FlexRowContainer>
      <GridEditable
        isLoading={isDataLoading}
        data={mergedTableData}
        columnOrder={COLUMN_ORDER}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell: (column: GridColumnHeader, dataRow: TransactionListDataRow) =>
            renderBodyCell(column, dataRow),
        }}
        location={location}
      />
    </div>
  );
}

type SimplePaginationProps = {
  disableLeft?: boolean;
  disableRight?: boolean;
  onLeftClick?: () => void;
  onRightClick?: () => void;
};

function SimplePagination(props: SimplePaginationProps) {
  return (
    <ButtonBar merged>
      <Button
        icon={<IconChevron direction="left" size="sm" />}
        aria-label={t('Previous')}
        disabled={props.disableLeft}
        onClick={props.onLeftClick}
      />
      <Button
        icon={<IconChevron direction="right" size="sm" />}
        aria-label={t('Next')}
        onClick={props.onRightClick}
        disabled={props.disableRight}
      />
    </ButtonBar>
  );
}
const throughputQueryToChartData = (
  data: any,
  startTime: moment.Moment,
  endTime: moment.Moment
): Series[] => {
  const countSeries: Series = {seriesName: 'count()', data: [] as any[]};
  const p75Series: Series = {seriesName: 'p75()', data: [] as any[]};
  data.forEach(({count, p75, interval}: any) => {
    countSeries.data.push({value: count, name: interval});
    p75Series.data.push({value: p75, name: interval});
  });
  return [
    zeroFillSeries(countSeries, moment.duration(INTERVAL, 'hours'), startTime, endTime),
    zeroFillSeries(p75Series, moment.duration(INTERVAL, 'hours'), startTime, endTime),
  ];
};

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
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
`;

const FlexRowItem = styled('div')`
  padding-right: ${space(4)};
  flex: 1;
`;

const FormattedCode = styled('div')`
  padding: ${space(1)};
  margin-bottom: ${space(3)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  overflow-x: auto;
  white-space: pre;
`;

const Operation = styled('b')`
  color: ${p => p.theme.blue400};
`;

const Domain = styled('b')`
  color: ${p => p.theme.green400};
  margin-right: -${space(0.5)};
`;

const Keyword = styled('b')`
  color: ${p => p.theme.yellow400};
`;

const Bracket = styled('b')`
  color: ${p => p.theme.pink400};
`;

const Paginator = styled('div')`
  width: 33%;
  position: absolute;
  right: 0;
`;
