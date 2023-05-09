import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';
import moment from 'moment';

import Badge from 'sentry/components/badge';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import Detail from 'sentry/views/starfish/components/detailPanel';
import QueryTransactionTable, {
  PanelSort,
} from 'sentry/views/starfish/modules/databaseModule/panel/queryTransactionTable';
import SimilarQueryView from 'sentry/views/starfish/modules/databaseModule/panel/similarQueryView';
import {
  useQueryPanelEventCount,
  useQueryPanelGraph,
  useQueryPanelTable,
  useQueryTransactionByTPMAndP75,
} from 'sentry/views/starfish/modules/databaseModule/queries';
import {queryToSeries} from 'sentry/views/starfish/modules/databaseModule/utils';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

import {DataRow, MainTableSort} from '../databaseTableView';

const INTERVAL = 12;

type DbQueryDetailProps = {
  isDataLoading: boolean;
  mainTableSort: MainTableSort;
  onRowChange: (row: DataRow | undefined) => void;
  row: DataRow;
  nextRow?: DataRow;
  prevRow?: DataRow;
};

export type TransactionListDataRow = {
  count: number;
  frequency: number;
  group_id: string;
  p75: number;
  transaction: string;
  uniqueEvents: number;
};

export default function QueryDetail({
  row,
  nextRow,
  prevRow,
  isDataLoading,
  onClose,
  onRowChange,
  mainTableSort,
}: Partial<DbQueryDetailProps> & {
  isDataLoading: boolean;
  mainTableSort: MainTableSort;
  onClose: () => void;
  onRowChange: (row: DataRow) => void;
}) {
  return (
    <Detail detailKey={row?.description} onClose={onClose}>
      {row && (
        <QueryDetailBody
          mainTableSort={mainTableSort}
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

function QueryDetailBody({
  row,
  nextRow,
  prevRow,
  onRowChange,
  isDataLoading: isRowLoading,
}: DbQueryDetailProps) {
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);

  const [sort, setSort] = useState<PanelSort>({
    direction: undefined,
    sortHeader: undefined,
  });

  const {isLoading, data: graphData} = useQueryPanelGraph(row, INTERVAL);

  const {isLoading: isTableLoading, data: tableData} = useQueryPanelTable(
    row,
    sort.sortHeader?.key,
    sort.direction
  );

  const {isLoading: isP75GraphLoading, data: transactionGraphData} =
    useQueryTransactionByTPMAndP75(tableData.map(d => d.transaction).splice(0, 5));

  const {isLoading: isEventCountLoading, data: eventCountData} =
    useQueryPanelEventCount(row);

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
      return {...data, frequency, ...eventData} as TransactionListDataRow;
    }
    return data as TransactionListDataRow;
  });

  const [countSeries, p75Series] = throughputQueryToChartData(
    graphData,
    startTime,
    endTime
  );

  const tpmTransactionSeries = queryToSeries(
    transactionGraphData,
    'group',
    'count()',
    startTime,
    endTime
  );

  const p75TransactionSeries = queryToSeries(
    transactionGraphData,
    'group',
    'p75(transaction.duration)',
    startTime,
    endTime
  );

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
      <FormattedCode>{highlightSql(row.formatted_desc, row)}</FormattedCode>
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
          <SubHeader>{t('Top 5 Transactions by Throughput')}</SubHeader>
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
        <FlexRowItem>
          <SubHeader>{t('Top 5 Transactions by P75')}</SubHeader>
          <Chart
            statsPeriod="24h"
            height={140}
            data={p75TransactionSeries}
            start=""
            end=""
            loading={isP75GraphLoading}
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
      <QueryTransactionTable
        isDataLoading={isDataLoading}
        onClickSort={s => setSort(s)}
        row={row}
        sort={sort}
        tableData={mergedTableData}
      />
      <FlexRowContainer>
        <FlexRowItem>
          <SubHeader>{t('Similar Queries')}</SubHeader>
          <SimilarQueryView mainTableRow={row} />
        </FlexRowItem>
      </FlexRowContainer>
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

export const highlightSql = (description: string, queryDetail: DataRow) => {
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
};

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
