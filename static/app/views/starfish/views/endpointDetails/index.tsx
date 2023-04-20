import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment';

import Duration from 'sentry/components/duration';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import Chart from 'sentry/views/starfish/components/chart';
import Detail from 'sentry/views/starfish/components/detailPanel';
import {HOST} from 'sentry/views/starfish/modules/APIModule/APIModuleView';
import {
  OverflowEllipsisTextContainer,
  renderHeadCell,
  TextAlignRight,
} from 'sentry/views/starfish/modules/APIModule/endpointTable';
import {
  getEndpointDetailSeriesQuery,
  getEndpointDetailTableQuery,
} from 'sentry/views/starfish/modules/APIModule/queries';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

export type EndpointDataRow = {
  count: number;
  description: string;
  domain: string;
  failure_count: number;
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
  {
    key: 'failure_rate',
    name: 'Error %',
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
  const tableQuery = getEndpointDetailTableQuery(row.description);
  const {isLoading: seriesIsLoading, data: seriesData} = useQuery({
    queryKey: [seriesQuery],
    queryFn: () => fetch(`${HOST}/?query=${seriesQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
  const {isLoading: tableIsLoading, data: tableData} = useQuery({
    queryKey: [tableQuery],
    queryFn: () => fetch(`${HOST}/?query=${tableQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
  const [p50Series, p95Series, countSeries, errorRateSeries] =
    endpointDetailDataToChartData(seriesData).map(series =>
      zeroFillSeries(series, moment.duration(12, 'hours'))
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
              seconds={row['p50(exclusive_time)'] / 1000}
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
              seconds={row['p95(exclusive_time)'] / 1000}
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
          <SubSubHeader>{row.failure_count}</SubSubHeader>
          <APIDetailChart
            series={errorRateSeries}
            isLoading={seriesIsLoading}
            index={1}
            outOf={4}
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
          renderBodyCell: (column: GridColumnHeader, dataRow: SpanTransactionDataRow) =>
            renderBodyCell(column, dataRow, row.description),
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
  spanDescription: string
): React.ReactNode {
  if (column.key === 'transaction') {
    return (
      <Link
        to={`/starfish/span/${encodeURIComponent(spanDescription)}:${encodeURIComponent(
          row.transaction
        )}`}
      >
        {row[column.key]}
      </Link>
    );
  }

  // TODO: come up with a better way to identify number columns to align to the right
  if (column.key.toString().match(/^p\d\d/)) {
    return (
      <TextAlignRight>
        <Duration seconds={row[column.key] / 1000} fixedDigits={2} abbreviation />
      </TextAlignRight>
    );
  }
  if (!['description', 'transaction'].includes(column.key.toString())) {
    return (
      <TextAlignRight>
        <OverflowEllipsisTextContainer>{row[column.key]}</OverflowEllipsisTextContainer>
      </TextAlignRight>
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
