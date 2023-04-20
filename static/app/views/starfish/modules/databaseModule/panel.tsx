import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {useLocation} from 'sentry/utils/useLocation';
import Chart from 'sentry/views/starfish/components/chart';
import Detail from 'sentry/views/starfish/components/detailPanel';

import {DataRow} from './databaseTableView';

const HOST = 'http://localhost:8080';

type EndpointDetailBodyProps = {
  row: DataRow;
};

type TransactionListDataRow = {
  count: number;
  p50: number;
  transaction: string;
};

const COLUMN_ORDER = [
  {
    key: 'transaction',
    name: 'Transaction',
    width: 400,
  },
  {
    key: 'count',
    name: 'Count',
  },
  {
    key: 'p50',
    name: 'p50',
  },
];

export default function QueryDetail({
  row,
  onClose,
}: Partial<EndpointDetailBodyProps> & {onClose: () => void}) {
  return (
    <Detail detailKey={row?.desc} onClose={onClose}>
      {row && <QueryDetailBody row={row} />}
    </Detail>
  );
}

function QueryDetailBody({row}: EndpointDetailBodyProps) {
  const theme = useTheme();
  const location = useLocation();

  const TABLE_QUERY = `
    SELECT transaction, count() AS count, quantile(0.5)(exclusive_time) as p50
    FROM spans_experimental_starfish
    WHERE module = 'db'
    AND description = '${row.desc}'
    GROUP BY transaction
    ORDER BY count DESC
    LIMIT 10
  `;

  const GRAPH_QUERY = `SELECT
      toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
      quantile(0.5)(exclusive_time) as p50,
      count() as count
      FROM spans_experimental_starfish
      WHERE module = 'db'
      AND description = '${row.desc}'
      GROUP BY interval
      ORDER BY interval asc
   `;

  const {isLoading, data: graphData} = useQuery({
    queryKey: ['dbQueryDetailsGraph', row.desc],
    queryFn: () => fetch(`${HOST}/?query=${GRAPH_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {isLoading: isTableLoading, data: tableData} = useQuery({
    queryKey: ['dbQueryDetailsTable', row.desc],
    queryFn: () => fetch(`${HOST}/?query=${TABLE_QUERY}`).then(res => res.json()),
    retry: true,
    initialData: [],
  });

  // console.log(row.desc);

  const [countSeries, p50Series] = throughputQueryToChartData(graphData);

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    return <span>{column.name}</span>;
  }

  const renderBodyCell = (
    column: GridColumnHeader,
    dataRow: TransactionListDataRow
  ): React.ReactNode => {
    if (column.key === 'transaction') {
      return (
        <Link
          to={`/starfish/span/${encodeURIComponent(row.desc)}:${encodeURIComponent(
            dataRow.transaction
          )}`}
        >
          {dataRow[column.key]}
        </Link>
      );
    }
    return <span>{dataRow[column.key]}</span>;
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
      <pre>{row.desc}</pre>
      <FlexRowContainer>
        <FlexRowItem>
          <SubHeader>{t('Throughput')}</SubHeader>
          <SubSubHeader>123</SubSubHeader>
          <Chart
            statsPeriod="24h"
            height={140}
            data={[countSeries]}
            start=""
            end=""
            loading={isLoading}
            utc={false}
            disableMultiAxis
            stacked
            isLineChart
            disableXAxis
            hideYAxisSplitLine
          />
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>{t('Duration (P50)')}</SubHeader>
          <SubSubHeader>{'123ms'}</SubSubHeader>
          <Chart
            statsPeriod="24h"
            height={140}
            data={[p50Series]}
            start=""
            end=""
            loading={isLoading}
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
        isLoading={isTableLoading}
        data={tableData}
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

const throughputQueryToChartData = (data: any): Series[] => {
  const countSeries: Series = {seriesName: 'count()', data: [] as any[]};
  const p50Series: Series = {seriesName: 'p50()', data: [] as any[]};
  data.forEach(({count, p50, interval}: any) => {
    countSeries.data.push({value: count, name: interval});
    p50Series.data.push({value: p50, name: interval});
  });
  return [countSeries, p50Series];
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
