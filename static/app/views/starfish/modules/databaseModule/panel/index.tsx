import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';
import moment from 'moment';

import Badge from 'sentry/components/badge';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import Detail from 'sentry/views/starfish/components/detailPanel';
import {FormattedCode} from 'sentry/views/starfish/components/formattedCode';
import ProfileView from 'sentry/views/starfish/modules/databaseModule/panel/profileView';
import QueryTransactionTable, {
  PanelSort,
} from 'sentry/views/starfish/modules/databaseModule/panel/queryTransactionTable';
import SimilarQueryView from 'sentry/views/starfish/modules/databaseModule/panel/similarQueryView';
import {
  useQueryExampleTransaction,
  useQueryGetEvent,
  useQueryPanelEventCount,
  useQueryPanelGraph,
  useQueryPanelSparklines,
  useQueryPanelTable,
  useQueryTransactionByTPMAndP75,
} from 'sentry/views/starfish/modules/databaseModule/queries';
import {
  generateMarkLine,
  queryToSeries,
} from 'sentry/views/starfish/modules/databaseModule/utils';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

import {DataRow, MainTableSort} from '../databaseTableView';

const INTERVAL = 12;
const SPARKLINE_INTERVAL = 24;

type DbQueryDetailProps = {
  isDataLoading: boolean;
  mainTableSort: MainTableSort;
  onRowChange: (row: DataRow | undefined) => void;
  row: DataRow;
  nextRow?: DataRow;
  prevRow?: DataRow;
  transaction?: string;
};

export type TransactionListDataRow = {
  count: number;
  example: string;
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
  transaction,
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
          transaction={transaction}
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
  transaction,
  isDataLoading: isRowLoading,
}: DbQueryDetailProps) {
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const organization = useOrganization();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const isNew = row.newish === 1;
  const isOld = row.retired === 1;

  const [sort, setSort] = useState<PanelSort>({
    direction: undefined,
    sortHeader: undefined,
  });

  const {isLoading, data: graphData} = useQueryPanelGraph(row, INTERVAL);

  const {isLoading: isTableLoading, data: tableData} = useQueryPanelTable(
    row,
    sort.sortHeader?.key,
    sort.direction,
    transaction
  );

  const {isLoading: isSparklinesLoading, data: sparklineData} = useQueryPanelSparklines(
    row,
    sort.sortHeader?.key,
    sort.direction,
    SPARKLINE_INTERVAL,
    transaction
  );

  const {isLoading: isP75GraphLoading, data: transactionGraphData} =
    useQueryTransactionByTPMAndP75(
      tableData.map(d => d.transaction).splice(0, 5),
      SPARKLINE_INTERVAL
    );

  const {isLoading: isEventCountLoading, data: eventCountData} =
    useQueryPanelEventCount(row);

  const {isLoading: isExampleLoading, data: exampleTransaction} =
    useQueryExampleTransaction(row);

  const {isLoading: isFirstExampleLoading, data: firstSeenExample} = useQueryGetEvent(
    exampleTransaction?.[0]?.first
  );
  const {isLoading: isLastExampleLoading, data: lastSeenExample} = useQueryGetEvent(
    exampleTransaction?.[0]?.latest
  );

  const isDataLoading =
    isLoading ||
    isTableLoading ||
    isEventCountLoading ||
    isRowLoading ||
    isP75GraphLoading ||
    isExampleLoading ||
    isFirstExampleLoading ||
    isLastExampleLoading ||
    isSparklinesLoading;

  const eventCountMap = keyBy(eventCountData, 'transaction');

  const mergedTableData: TransactionListDataRow[] = tableData.map(data => {
    const tableTransaction = data.transaction;
    const eventData = eventCountMap[tableTransaction];
    if (eventData?.uniqueEvents) {
      const frequency = data.count / eventData.uniqueEvents;
      return {...data, frequency, ...eventData} as TransactionListDataRow;
    }
    return data as TransactionListDataRow;
  });

  const [countSeries, p50Series, p95Series] = throughputQueryToChartData(
    graphData,
    startTime,
    endTime
  );

  const spmTransactionSeries = queryToSeries(
    sparklineData,
    'transaction',
    'spm',
    startTime,
    endTime,
    SPARKLINE_INTERVAL
  );

  const spanp50TransactionSeries = queryToSeries(
    sparklineData,
    'transaction',
    'p50',
    startTime,
    endTime,
    SPARKLINE_INTERVAL
  );

  const tpmTransactionSeries = queryToSeries(
    transactionGraphData,
    'group',
    'epm()',
    startTime,
    endTime,
    SPARKLINE_INTERVAL
  );

  const p50TransactionSeries = queryToSeries(
    transactionGraphData,
    'group',
    'p50(transaction.duration)',
    startTime,
    endTime,
    SPARKLINE_INTERVAL
  );

  const markLine =
    spmTransactionSeries?.[0]?.data && (isNew || isOld)
      ? generateMarkLine(
          isNew ? 'First Seen' : 'Last Seen',
          isNew ? row.firstSeen : row.lastSeen,
          spmTransactionSeries[0].data,
          theme
        )
      : undefined;

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
          {Math.abs(moment(row.firstSeen).diff(startTime, 'minutes')) < 720 ? (
            <SubSubHeader>
              More than <TimeSince date={row.firstSeen} />{' '}
            </SubSubHeader>
          ) : (
            <span>
              <SubSubHeader>
                <TimeSince date={row.firstSeen} />{' '}
              </SubSubHeader>
              {firstSeenExample?.release && (
                <VersionHoverCard
                  organization={organization}
                  projectSlug="sentry"
                  releaseVersion={firstSeenExample.release.version}
                  showUnderline
                  underlineColor="linkUnderline"
                >
                  <Version version={String(firstSeenExample.release.version)} truncate />
                </VersionHoverCard>
              )}
            </span>
          )}
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>
            {t('Last Seen')}
            {row.retired === 1 && <Badge type="warning" text="old" />}
          </SubHeader>
          <SubSubHeader>
            <TimeSince date={row.lastSeen} />
          </SubSubHeader>
          {lastSeenExample?.release && (
            <VersionHoverCard
              organization={organization}
              projectSlug="sentry"
              releaseVersion={lastSeenExample.release.version}
              showUnderline
              underlineColor="linkUnderline"
            >
              <Version version={String(lastSeenExample.release.version)} truncate />
            </VersionHoverCard>
          )}
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
          <SubHeader>{t('Throughput (Spans Per Minute)')}</SubHeader>
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
          <SubHeader>{t('Duration P50 / P95')}</SubHeader>
          <SubSubHeader>
            {row.p50.toFixed(3)}ms / {row.p95.toFixed(3)}ms
          </SubSubHeader>
          <Chart
            statsPeriod="24h"
            height={140}
            data={[p50Series, p95Series]}
            start=""
            end=""
            loading={isDataLoading}
            utc={false}
            chartColors={theme.charts.getColorPalette(4).slice(3, 5)}
            stacked
            isLineChart
            disableXAxis
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
        spmData={spmTransactionSeries}
        tpmData={tpmTransactionSeries}
        spanP50Data={spanp50TransactionSeries}
        txnP50Data={p50TransactionSeries}
        markLine={markLine}
      />
      <FlexRowContainer>
        <FlexRowItem>
          <SubHeader>{t('Example Profile')}</SubHeader>
          <ProfileView
            spanHash={row.group_id}
            transactionNames={tableData.map(d => d.transaction)}
          />
        </FlexRowItem>
      </FlexRowContainer>
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
  const countSeries: Series = {seriesName: 'spm()', data: [] as any[]};
  const p50Series: Series = {seriesName: 'p50()', data: [] as any[]};
  const p95Series: Series = {seriesName: 'p95()', data: [] as any[]};
  data.forEach(({count, p50, p95, interval}) => {
    countSeries.data.push({value: count, name: interval});
    p50Series.data.push({value: p50, name: interval});
    p95Series.data.push({value: p95, name: interval});
  });
  return [
    zeroFillSeries(countSeries, moment.duration(INTERVAL, 'hours'), startTime, endTime),
    zeroFillSeries(p50Series, moment.duration(INTERVAL, 'hours'), startTime, endTime),
    zeroFillSeries(p95Series, moment.duration(INTERVAL, 'hours'), startTime, endTime),
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
