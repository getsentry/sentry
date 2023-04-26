import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import keyBy from 'lodash/keyBy';
import merge from 'lodash/merge';
import values from 'lodash/values';
import moment from 'moment';
import * as qs from 'query-string';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
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
  row: DataRow;
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
  onClose,
}: Partial<EndpointDetailBodyProps> & {onClose: () => void}) {
  return (
    <Detail detailKey={row?.description} onClose={onClose}>
      {row && <QueryDetailBody row={row} />}
    </Detail>
  );
}

function QueryDetailBody({row}: EndpointDetailBodyProps) {
  const theme = useTheme();
  const location = useLocation();
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const DATE_FILTERS = `
    start_timestamp > fromUnixTimestamp(${startTime.unix()}) and
    start_timestamp < fromUnixTimestamp(${endTime.unix()})
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
      queryKey: ['dbQueryDetailsTable', row.description, pageFilter.selection.datetime],
      queryFn: () =>
        fetch(`${HOST}/?query=${getPanelTableQuery(DATE_FILTERS, row)}`).then(res =>
          res.json()
        ),
      retry: true,
      initialData: [],
    }
  );

  const {isLoading: isEventCountLoading, data: eventCountData} = useQuery({
    queryKey: [
      'dbQueryDetailsEventCount',
      row.description,
      pageFilter.selection.datetime,
    ],
    queryFn: () =>
      fetch(`${HOST}/?query=${getPanelEventCount(DATE_FILTERS, row)}`).then(res =>
        res.json()
      ),
    retry: true,
    initialData: [],
  });

  const isDataLoading = isLoading || isTableLoading || isEventCountLoading;

  const mergedTableData = values(
    merge(keyBy(eventCountData, 'transaction'), keyBy(tableData, 'transaction'))
  ).filter((data: Partial<TransactionListDataRow>) => !!data.count && !!data.p75);

  const [countSeries, p75Series] = throughputQueryToChartData(
    graphData,
    startTime,
    endTime
  );
  const percentileSeries: Series = {
    seriesName: 'p75()',
    data: tableData.map(tableRow => ({name: tableRow.transaction, value: tableRow.p75})),
  };

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
      return <span>{value?.toFixed(2)}ms</span>;
    }
    return <span>{value}</span>;
  };

  return (
    <div>
      <h2>{t('Query Detail')}</h2>
      <p>
        {t(
          'Detailed summary of db query spans. Detailed summary of db query spans. Detailed summary of db query spans. Detailed summary of db query spans. Detailed summary of db query spans. Detailed summary of db query spans.'
        )}
      </p>
      <SubHeader>{t('Query Description')}</SubHeader>
      <FormattedCode>{row.formatted_desc}</FormattedCode>
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
      {row.transactions > 1 && (
        <FlexRowContainer>
          <FlexRowItem>
            <SubHeader>{t('Percentiles')}</SubHeader>
            <Chart
              statsPeriod="24h"
              height={140}
              data={[percentileSeries]}
              start=""
              end=""
              loading={isLoading}
              utc={false}
              disableMultiAxis
              stacked
              isBarChart
              hideYAxisSplitLine
            />
          </FlexRowItem>
        </FlexRowContainer>
      )}
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
