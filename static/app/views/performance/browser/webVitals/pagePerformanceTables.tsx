import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {getScoreColor} from 'sentry/views/performance/browser/webVitals/utils/getScoreColor';
import {Row} from 'sentry/views/performance/browser/webVitals/utils/types';

type RowWithScore = Row & {score: number};

const MAX_ROWS = 7;

type Column = GridColumnHeader<keyof RowWithScore>;

const columnOrder: GridColumnOrder<keyof RowWithScore>[] = [
  {key: 'transaction', width: COL_WIDTH_UNDEFINED, name: 'Transaction'},
  {key: 'count()', width: COL_WIDTH_UNDEFINED, name: 'Count'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Score'},
];

const sort: GridColumnSortBy<keyof Row> = {key: 'count()', order: 'desc'};

export function PagePerformanceTables() {
  const theme = useTheme();
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();
  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'transaction',
        'transaction.op',
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.app_init_long_tasks)',
        'count()',
      ],
      name: 'Web Vitals',
      query:
        'transaction.op:pageload (transaction:/performance* or transaction:/discover* or transaction:/dashboards*)',
      orderby: `-count()`,
      version: 2,
    },
    pageFilters.selection
  );
  const {data, isLoading} = useDiscoverQuery({
    eventView,
    limit: 50,
    location,
    orgSlug: organization.slug,
    options: {
      enabled: pageFilters.isReady,
      refetchOnWindowFocus: false,
    },
  });

  const tableData: RowWithScore[] =
    !isLoading && data?.data.length
      ? data.data
          .map(row => ({
            transaction: row.transaction?.toString(),
            'transaction.op': row['transaction.op']?.toString(),
            'p75(measurements.lcp)': row['p75(measurements.lcp)'] as number,
            'p75(measurements.fcp)': row['p75(measurements.fcp)'] as number,
            'p75(measurements.cls)': row['p75(measurements.cls)'] as number,
            'p75(measurements.app_init_long_tasks)': row[
              'p75(measurements.app_init_long_tasks)'
            ] as number,
            'count()': row['count()'] as number,
          }))
          .map(row => ({
            ...row,
            score: calculatePerformanceScore(row).totalScore,
          }))
          .sort((a, b) => b['count()'] - a['count()'])
      : [];

  const good = tableData.filter(row => row.score >= 90).slice(0, MAX_ROWS);
  const needsImprovement = tableData
    .filter(row => row.score >= 50 && row.score < 90)
    .slice(0, MAX_ROWS);
  const bad = tableData.filter(row => row.score < 50).slice(0, MAX_ROWS);

  const getRenderHeadCell = (label, threshold) => {
    return function (col: Column) {
      if (col.key === 'score') {
        return <AlignRight>{threshold}</AlignRight>;
      }
      if (col.key === 'transaction') {
        return <NoOverflow>{label}</NoOverflow>;
      }
      return <AlignRight>{col.name}</AlignRight>;
    };
  };

  function renderBodyCell(col: Column, row: RowWithScore) {
    const {key} = col;
    if (key === 'score') {
      return <AlignRight color={getScoreColor(row.score, theme)}>{row.score}</AlignRight>;
    }
    if (key === 'count()') {
      return <AlignRight>{row['count()']}</AlignRight>;
    }
    return <NoOverflow>{row[key]}</NoOverflow>;
  }

  return (
    <div>
      <Flex>
        <GridContainer>
          <GridEditable
            data={bad}
            isLoading={isLoading}
            columnOrder={columnOrder}
            columnSortBy={[sort]}
            grid={{
              renderHeadCell: getRenderHeadCell('Bad', '<50'),
              renderBodyCell,
            }}
            location={location}
          />
        </GridContainer>
        <GridContainer>
          <GridEditable
            data={needsImprovement}
            isLoading={isLoading}
            columnOrder={columnOrder}
            columnSortBy={[sort]}
            grid={{
              renderHeadCell: getRenderHeadCell('Needs Improvement', '>= 50'),
              renderBodyCell,
            }}
            location={location}
          />
        </GridContainer>
        <GridContainer>
          <GridEditable
            data={good}
            isLoading={isLoading}
            columnOrder={columnOrder}
            columnSortBy={[sort]}
            grid={{
              renderHeadCell: getRenderHeadCell('Good', '>= 90'),
              renderBodyCell,
            }}
            location={location}
          />
        </GridContainer>
      </Flex>
      <ShowMore>{t('Show More')}</ShowMore>
    </div>
  );
}

const Flex = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  gap: ${space(2)};
  margin-top: ${space(2)};
`;

const GridContainer = styled('div')`
  min-width: 320px;
  flex: 1;
`;

const NoOverflow = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AlignRight = styled('span')<{color?: string}>`
  text-align: right;
  width: 100%;
  ${p => (p.color ? `color: ${p.color};` : '')}
`;

const ShowMore = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  text-align: center;
  margin-top: ${space(2)};
  cursor: pointer;
  &:hover {
    color: ${p => p.theme.gray400};
  }
`;
