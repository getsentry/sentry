import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import Chart from 'sentry/views/starfish/components/chart';
import Detail from 'sentry/views/starfish/components/detailPanel';
import {DataRow, HOST} from 'sentry/views/starfish/modules/APIModule/APIModuleView';
import {
  renderBodyCell,
  renderHeadCell,
} from 'sentry/views/starfish/modules/APIModule/endpointTable';
import {
  getEndpointDetailErrorRateSeriesQuery,
  getEndpointDetailQuery,
  getEndpointDetailSeriesQuery,
} from 'sentry/views/starfish/modules/APIModule/queries';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

type EndpointDetailBodyProps = {
  row: DataRow;
};

const COLUMN_ORDER = [
  {
    key: 'transaction',
    name: 'Transaction',
    width: 350,
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
  const seriesQuery = getEndpointDetailSeriesQuery(row.description);
  const errorRateSeriesQuery = getEndpointDetailErrorRateSeriesQuery(row.description);
  const tableQuery = getEndpointDetailQuery(row.description);
  const {isLoading: seriesIsLoading, data: seriesData} = useQuery({
    queryKey: ['endpointDetailSeries'],
    queryFn: () => fetch(`${HOST}/?query=${seriesQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
  const {isLoading: errorRateSeriesIsLoading, data: errorRateSeriesData} = useQuery({
    queryKey: ['endpointDetailErrorRateSeries'],
    queryFn: () =>
      fetch(`${HOST}/?query=${errorRateSeriesQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
  const {isLoading: tableIsLoading, data: tableData} = useQuery({
    queryKey: ['endpointDetailTable'],
    queryFn: () => fetch(`${HOST}/?query=${tableQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
  const [p50Series, p95Series, countSeries] = endpointDetailDataToChartData(
    seriesData
  ).map(series => zeroFillSeries(series, moment.duration(12, 'hours')));
  const [errorRateSeries] = endpointDetailDataToChartData(errorRateSeriesData).map(
    series => zeroFillSeries(series, moment.duration(12, 'hours'))
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
          <SubSubHeader>{'123ms'}</SubSubHeader>
          <APIDetailChart
            series={p50Series}
            isLoading={seriesIsLoading}
            index={2}
            outOf={4}
          />
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>{t('Duration (P95)')}</SubHeader>
          <SubSubHeader>{'123ms'}</SubSubHeader>
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
          <SubSubHeader>{row.count}</SubSubHeader>
          <APIDetailChart
            series={errorRateSeries}
            isLoading={errorRateSeriesIsLoading}
            index={1}
            outOf={4}
          />
        </FlexRowItem>
      </FlexRowContainer>
      <div>
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
          scrollable={false}
        />
      </div>
    </div>
  );
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
  index: number;
  isLoading: boolean;
  outOf: number;
  series: any;
}) {
  const theme = useTheme();
  return (
    <Chart
      statsPeriod="24h"
      height={110}
      data={props.series ? [props.series] : []}
      start=""
      end=""
      loading={props.isLoading}
      utc={false}
      disableMultiAxis
      stacked
      isLineChart
      disableXAxis
      hideYAxisSplitLine
      chartColors={[theme.charts.getColorPalette(props.outOf - 2)[props.index]]}
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
