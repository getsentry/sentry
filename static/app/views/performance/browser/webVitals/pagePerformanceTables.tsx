import {useMemo} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import {
  Grid,
  GridBody,
  GridBodyCell,
  GridRow,
} from 'sentry/components/gridEditable/styles';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {Row} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useTransactionWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useTransactionWebVitalsQuery';

type RowWithScore = Row & {score: number};

const MAX_ROWS = 6;

type Column = GridColumnHeader<keyof RowWithScore>;

const columnOrder: GridColumnOrder<keyof RowWithScore>[] = [
  {key: 'transaction', width: COL_WIDTH_UNDEFINED, name: 'Transaction'},
  {key: 'count()', width: COL_WIDTH_UNDEFINED, name: 'Page Loads'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Score'},
];

export function PagePerformanceTables() {
  const location = useLocation();
  const {projects} = useProjects();

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const {data} = useTransactionWebVitalsQuery({});

  const tableData: RowWithScore[] = data.sort((a, b) => b['count()'] - a['count()']);

  const good = tableData.filter(row => row.score >= 90).slice(0, MAX_ROWS);
  const needsImprovement = tableData
    .filter(row => row.score >= 50 && row.score < 90)
    .slice(0, MAX_ROWS);
  const bad = tableData.filter(row => row.score < 50).slice(0, MAX_ROWS);

  function renderBodyCell(col: Column, row: RowWithScore) {
    const {key} = col;
    if (key === 'score') {
      return (
        <AlignCenter>
          <PerformanceBadge score={row.score} />
        </AlignCenter>
      );
    }
    if (key === 'count()') {
      return <AlignRight>{formatAbbreviatedNumber(row['count()'])}</AlignRight>;
    }
    if (key === 'transaction') {
      const link = `/performance/summary/?${qs.stringify({
        project: project?.id,
        transaction: row.transaction,
      })}`;
      return (
        <NoOverflow>
          {project && (
            <StyledProjectAvatar
              project={project}
              direction="left"
              size={16}
              hasTooltip
              tooltip={project.slug}
            />
          )}
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
          <GridDescription>
            <GridDescriptionHeader>{t('Poor Score')}</GridDescriptionHeader>
            {t('Pageload scores less than 50')}
          </GridDescription>
          <StyledGrid data-test-id="grid-editable" scrollable={false}>
            <GridContent data={bad} renderBodyCell={renderBodyCell} />
          </StyledGrid>
        </GridContainer>
        <GridContainer>
          <GridDescription>
            <GridDescriptionHeader>{t('Meh Score')}</GridDescriptionHeader>
            {t('Pageload scores greater than or equal to 50')}
          </GridDescription>
          <StyledGrid data-test-id="grid-editable" scrollable={false}>
            <GridContent data={needsImprovement} renderBodyCell={renderBodyCell} />
          </StyledGrid>
        </GridContainer>
        <GridContainer>
          <GridDescription>
            <GridDescriptionHeader>{t('Good Score')}</GridDescriptionHeader>
            {t('Pageload scores greater than or equal to 90')}
          </GridDescription>
          <StyledGrid data-test-id="grid-editable" scrollable={false}>
            <GridContent data={good} renderBodyCell={renderBodyCell} />
          </StyledGrid>
        </GridContainer>
      </Flex>
      <ShowMore>{t('Show More')}</ShowMore>
    </div>
  );
}

function GridContent({data, renderBodyCell}) {
  return (
    <GridBody>
      {data.map(row => {
        return (
          <GridRow key={row.transaction}>
            {columnOrder.map(column => (
              <GridBodyCell key={`${row.transaction} ${column.key}`}>
                {renderBodyCell(column, row)}
              </GridBodyCell>
            ))}
          </GridRow>
        );
      })}
    </GridBody>
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
  white-space: nowrap;
`;

const AlignRight = styled('span')<{color?: string}>`
  text-align: right;
  width: 100%;
  ${p => (p.color ? `color: ${p.color};` : '')}
`;

const AlignCenter = styled('span')`
  text-align: center;
  width: 100%;
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

const StyledGrid = styled(Grid)`
  grid-template-columns: minmax(90px, auto) minmax(90px, auto) minmax(90px, auto);
  border: 1px solid ${p => p.theme.border};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};

  > tbody > tr:first-child td {
    border-top: none;
  }
`;

const GridDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)} ${space(2)};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  border: 1px solid ${p => p.theme.border};
  border-bottom: none;
  color: ${p => p.theme.gray300};
`;

const GridDescriptionHeader = styled('div')`
  font-weight: bold;
  color: ${p => p.theme.textColor};
`;

const StyledProjectAvatar = styled(ProjectAvatar)`
  top: ${space(0.25)};
  position: relative;
  padding-right: ${space(1)};
`;
