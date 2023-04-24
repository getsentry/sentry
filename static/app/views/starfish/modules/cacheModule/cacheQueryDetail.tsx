import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {useQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import Chart from 'sentry/views/starfish/components/chart';
import Detail from 'sentry/views/starfish/components/detailPanel';
import {DataRow} from 'sentry/views/starfish/modules/cacheModule/cacheTableView';

type CacheDetailBodyProps = {
  row: DataRow;
};

const HOST = 'http://localhost:8080';

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

export default function CacheDetail({
  row,
  onClose,
}: Partial<CacheDetailBodyProps> & {onClose: () => void}) {
  return (
    <Detail detailKey={row?.description} onClose={onClose}>
      {row && <EndpointDetailBody row={row} />}
    </Detail>
  );
}

function EndpointDetailBody({row}: CacheDetailBodyProps) {
  const theme = useTheme();
  const location = useLocation();

  const TABLE_QUERY = `
    SELECT transaction, count() AS count, quantile(0.5)(exclusive_time) as p50
    FROM spans_experimental_starfish
    WHERE module = 'cache'
    AND description = '${row.description.replaceAll("'", "\\'")}'
    GROUP BY transaction
    ORDER BY count DESC
    LIMIT 10
  `;

  const GRAPH_QUERY = `SELECT
      toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
      quantile(0.5)(exclusive_time) as p50,
      count() as count
      FROM spans_experimental_starfish
      WHERE module = 'cache'
      AND description = '${row.description.replaceAll("'", "\\'")}'
      GROUP BY interval
      ORDER BY interval asc
   `;

  const {isLoading, data: graphData} = useQuery({
    queryKey: ['dbQueryDetailsGraph', row.description],
    queryFn: () => fetch(`${HOST}/?query=${GRAPH_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {isLoading: isTableLoading, data: tableData} = useQuery({
    queryKey: ['dbQueryDetailsTable', row.description],
    queryFn: () => fetch(`${HOST}/?query=${TABLE_QUERY}`).then(res => res.json()),
    retry: true,
    initialData: [],
  });

  const [countSeries, p50Series] = throughputQueryToChartData(graphData);

  return (
    <div>
      <h2>{t('Command detail')}</h2>
      <p>{t('Detailed summary of redis span.')}</p>
      <SubHeader>{t('Command')}</SubHeader>
      <pre>{row.description}</pre>
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
          renderBodyCell: (column: GridColumnHeader, dataRow: DataRow) =>
            renderBodyCell(column, dataRow),
        }}
        location={location}
      />
    </div>
  );
}

function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  return <span>{column.name}</span>;
}

const renderBodyCell = (column: GridColumnHeader, row: DataRow): React.ReactNode => {
  return <span>{row[column.key]}</span>;
};

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
