import {useMemo} from 'react';
import {Link} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {getScoreColor} from 'sentry/views/performance/browser/webVitals/utils/getScoreColor';
import {Row} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useTransactionWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useTransactionWebVitalsQuery';

type RowWithScore = Row & {score: number};

const MAX_ROWS = 6;

type Column = GridColumnHeader<keyof RowWithScore>;

const columnOrder: GridColumnOrder<keyof RowWithScore>[] = [
  {key: 'transaction', width: COL_WIDTH_UNDEFINED, name: 'Transaction'},
  {key: 'count()', width: COL_WIDTH_UNDEFINED, name: 'Count'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Score'},
];

const sort: GridColumnSortBy<keyof Row> = {key: 'count()', order: 'desc'};

export function PagePerformanceTables() {
  const theme = useTheme();
  const location = useLocation();
  const {projects} = useProjects();

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const {data, isLoading} = useTransactionWebVitalsQuery({});

  const tableData: RowWithScore[] = data.sort((a, b) => b['count()'] - a['count()']);

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
    if (key === 'transaction') {
      const link = `/performance/summary/?${qs.stringify({
        project: project?.id,
        transaction: row.transaction,
      })}`;
      return (
        <NoOverflow>
          <Link to={link}>{row.transaction}</Link>
        </NoOverflow>
      );
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
