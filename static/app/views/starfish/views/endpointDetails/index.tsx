import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import Chart from 'sentry/views/starfish/components/chart';
import Detail from 'sentry/views/starfish/components/detailPanel';
import {
  DataRow,
  HOST,
  renderBodyCell,
  renderHeadCell,
} from 'sentry/views/starfish/modules/APIModule/APIModuleView';
import {
  getEndpointDetailQuery,
  getEndpointDetailSeriesQuery,
} from 'sentry/views/starfish/modules/APIModule/queries';

type EndpointDetailBodyProps = {
  row: DataRow;
};

const COLUMN_ORDER = [
  {
    key: 'transaction',
    name: 'Transaction',
    width: 300,
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
  const location = useLocation();
  const theme = useTheme();
  const seriesQuery = getEndpointDetailSeriesQuery(row.description);
  const tableQuery = getEndpointDetailQuery(row.description);
  const {isLoading: seriesIsLoading, data: seriesData} = useQuery({
    queryKey: ['endpointDetailSeries'],
    queryFn: () => fetch(`${HOST}/?query=${seriesQuery}`).then(res => res.json()),
    retry: true,
    initialData: [],
  });
  const {isLoading: tableIsLoading, data: tableData} = useQuery({
    queryKey: ['endpointDetailTable'],
    queryFn: () => fetch(`${HOST}/?query=${tableQuery}`).then(res => res.json()),
    retry: true,
    initialData: [],
  });
  const [countSeries, p50Series] = endpointDetailDataToChartData(seriesData);

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
          <SubHeader>{t('Throughput')}</SubHeader>
          <SubSubHeader>{row.count}</SubSubHeader>
          <Chart
            statsPeriod="24h"
            height={140}
            data={[countSeries]}
            start=""
            end=""
            loading={seriesIsLoading}
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
            loading={seriesIsLoading}
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
        isLoading={tableIsLoading}
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

function endpointDetailDataToChartData(data: any) {
  const countSeries = {seriesName: 'count()', data: [] as any[]};
  const p50Series = {seriesName: 'p50()', data: [] as any[]};
  data.forEach(({count, p50, interval}: any) => {
    countSeries.data.push({value: count, name: interval});
    p50Series.data.push({value: p50, name: interval});
  });
  return [countSeries, p50Series];
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
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
`;

const FlexRowItem = styled('div')`
  padding-right: ${space(4)};
  flex: 1;
`;
