import {CSSProperties, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import keyBy from 'lodash/keyBy';
import moment from 'moment';
import * as qs from 'query-string';

import Badge from 'sentry/components/badge';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {IconArrow, IconChevron} from 'sentry/icons';
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
  useQueryTransactionByTPM,
} from 'sentry/views/starfish/modules/databaseModule/queries';
import {
  datetimeToClickhouseFilterTimestamps,
  getDateFilters,
} from 'sentry/views/starfish/utils/dates';
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
  frequency: number;
  group_id: string;
  p75: number;
  transaction: string;
  uniqueEvents: number;
};

type Keys = 'transaction' | 'p75' | 'count' | 'frequency' | 'uniqueEvents';

type TableColumnHeader = GridColumnHeader<Keys>;

const COLUMN_ORDER: TableColumnHeader[] = [
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
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(
    pageFilter.selection.datetime
  );
  const DATE_FILTERS = `
  ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
  ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
  `;

  const {isLoading: isP75GraphLoading, data: tpmTransactionGraphData} =
    useQueryTransactionByTPM(row);

  const [sort, setSort] = useState<{
    direction: 'desc' | 'asc' | undefined;
    sortHeader: TableColumnHeader | undefined;
  }>({direction: undefined, sortHeader: undefined});

  const {isLoading, data: graphData} = useQuery({
    queryKey: ['dbQueryDetailsGraph', row.group_id, pageFilter.selection.datetime],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getPanelGraphQuery(
          startTime,
          endTime,
          row,
          INTERVAL
        )}&format=sql`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {isLoading: isTableLoading, data: tableData} = useQuery<TransactionListDataRow[]>(
    {
      queryKey: [
        'dbQueryDetailsTable',
        row.group_id,
        pageFilter.selection.datetime,
        sort.sortHeader?.key,
        sort.direction,
      ],
      queryFn: () =>
        fetch(
          `${HOST}/?query=${getPanelTableQuery(
            startTime,
            endTime,
            row,
            sort.sortHeader?.key,
            sort.direction
          )}`
        ).then(res => res.json()),
      retry: true,
      initialData: [],
    }
  );

  const {isLoading: isEventCountLoading, data: eventCountData} = useQuery<
    Partial<TransactionListDataRow>[]
  >({
    queryKey: ['dbQueryDetailsEventCount', row.group_id, pageFilter.selection.datetime],
    queryFn: () =>
      fetch(`${HOST}/?query=${getPanelEventCount(DATE_FILTERS, row)}`).then(res =>
        res.json()
      ),
    retry: true,
    initialData: [],
  });

  const isDataLoading =
    isLoading ||
    isTableLoading ||
    isEventCountLoading ||
    isRowLoading ||
    isP75GraphLoading;

  const eventCountMap = keyBy(eventCountData, 'transaction');

  const mergedTableData: TransactionListDataRow[] = tableData.map(data => {
    const {transaction} = data;
    const eventData = eventCountMap[transaction];
    if (eventData?.uniqueEvents) {
      const frequency = data.count / eventData.uniqueEvents;
      return {...data, frequency, ...eventData};
    }
    return data;
  });

  const minMax = calculateOutlierMinMax(mergedTableData);

  const [countSeries, p75Series] = throughputQueryToChartData(
    graphData,
    startTime,
    endTime
  );

  const tpmTransactionSeries = tpmTransactionQueryToChartData(
    tpmTransactionGraphData,
    startTime,
    endTime
  );

  const onSortClick = (col: TableColumnHeader) => {
    let direction: 'desc' | 'asc' | undefined = undefined;
    if (sort.direction === 'desc') {
      direction = 'asc';
    } else if (!sort.direction) {
      direction = 'desc';
    }
    setSort({direction, sortHeader: col});
  };

  function renderHeadCell(col: TableColumnHeader): React.ReactNode {
    const {key, name} = col;
    const sortableKeys: Keys[] = ['p75', 'count'];
    if (sortableKeys.includes(key)) {
      const isBeingSorted = col.key === sort.sortHeader?.key;
      const direction = isBeingSorted ? sort.direction : undefined;
      return (
        <SortableHeader
          onClick={() => onSortClick(col)}
          direction={direction}
          title={name}
        />
      );
    }
    return <span>{name}</span>;
  }

  const renderBodyCell = (
    column: TableColumnHeader,
    dataRow: TransactionListDataRow
  ): React.ReactNode => {
    const {key} = column;
    const value = dataRow[key];
    const style: CSSProperties = {};
    let rendereredValue = value;

    if (
      minMax[key] &&
      ((value as number) > minMax[key].max || (value as number) < minMax[key].min)
    ) {
      style.color = theme.red400;
    }
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
      rendereredValue = `${dataRow[key]?.toFixed(2)}ms`;
    }
    if (key === 'frequency') {
      rendereredValue = dataRow[key]?.toFixed(2);
    }

    return <span style={style}>{rendereredValue}</span>;
  };

  return (
    <div>
      <FlexRowContainer>
        <FlexRowItem>
          <h2>{t('Query Detail')}</h2>
        </FlexRowItem>
        <FlexRowItem>
          <SimplePagination
            disableLeft={!prevRow}
            disableRight={!nextRow}
            onLeftClick={() => onRowChange(prevRow)}
            onRightClick={() => onRowChange(nextRow)}
          />
        </FlexRowItem>
      </FlexRowContainer>

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
            stacked
            isLineChart
            disableXAxis
            hideYAxisSplitLine
          />
        </FlexRowItem>
      </FlexRowContainer>
      <FlexRowContainer>
        <FlexRowItem>
          <SubHeader>{t('Highest throughput transactions')}</SubHeader>
          <Chart
            statsPeriod="24h"
            height={140}
            data={tpmTransactionSeries}
            start=""
            end=""
            loading={isDataLoading}
            grid={{
              left: '0',
              right: '0',
              top: '16px',
              bottom: '8px',
            }}
            utc={false}
            disableXAxis
            isLineChart
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
          renderBodyCell: (column: TableColumnHeader, dataRow: TransactionListDataRow) =>
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

const HeaderWrapper = styled('div')`
  cursor: pointer;
`;

export function SortableHeader({title, direction, onClick}) {
  const arrow = !direction ? null : (
    <StyledIconArrow size="xs" direction={direction === 'desc' ? 'down' : 'up'} />
  );
  return (
    <HeaderWrapper onClick={onClick}>
      {title} {arrow}
    </HeaderWrapper>
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

// Calculates the outlier min max for all number based rows based on the IQR Method
const calculateOutlierMinMax = (
  data: TransactionListDataRow[]
): Record<string, {max: number; min: number}> => {
  const minMax: Record<string, {max: number; min: number}> = {};
  if (data.length > 0) {
    Object.entries(data[0]).forEach(([colKey, value]) => {
      if (typeof value === 'number') {
        minMax[colKey] = findOutlierMinMax(data, colKey);
      }
    });
  }
  return minMax;
};

function findOutlierMinMax(data: any[], property: string): {max: number; min: number} {
  const sortedValues = [...data].sort((a, b) => a[property] - b[property]);

  if (data.length < 4) {
    return {min: data[0][property], max: data[data.length - 1][property]};
  }

  const q1 = sortedValues[Math.floor(sortedValues.length * (1 / 4))][property];
  const q3 = sortedValues[Math.ceil(sortedValues.length * (3 / 4))][property];
  const iqr = q3 - q1;

  return {min: q1 - iqr * 1.5, max: q3 + iqr * 1.5};
}

const tpmTransactionQueryToChartData = (
  data: {count: number; interval: string; transaction: string}[],
  startTime: moment.Moment,
  endTime: moment.Moment
): Series[] => {
  const seriesMap: Record<string, Series> = {};

  data.forEach(row => {
    const dataEntry = {value: row.count, name: row.interval};
    if (!seriesMap[row.transaction]) {
      seriesMap[row.transaction] = {
        seriesName: row.transaction,
        data: [],
      };
    }
    seriesMap[row.transaction].data.push(dataEntry);
  });
  return Object.values(seriesMap).map(series =>
    zeroFillSeries(series, moment.duration(INTERVAL, 'hours'), startTime, endTime)
  );
};
const StyledIconArrow = styled(IconArrow)`
  vertical-align: top;
`;

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
  padding-bottom: ${space(2)};
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
