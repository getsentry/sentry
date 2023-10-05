import {useMemo, useState} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import SearchBar from 'sentry/components/searchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {calculateOpportunity} from 'sentry/views/performance/browser/webVitals/utils/calculateOpportunity';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {Row} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {useTransactionWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useTransactionWebVitalsQuery';

type RowWithScoreAndOpportunity = Row & {opportunity: number; score: number};

type Column = GridColumnHeader<keyof RowWithScoreAndOpportunity>;

const columnOrder: GridColumnOrder<keyof RowWithScoreAndOpportunity>[] = [
  {key: 'transaction', width: COL_WIDTH_UNDEFINED, name: 'Pages'},
  {key: 'count()', width: COL_WIDTH_UNDEFINED, name: 'Pageloads'},
  {key: 'p75(measurements.lcp)', width: COL_WIDTH_UNDEFINED, name: 'LCP'},
  {key: 'p75(measurements.fcp)', width: COL_WIDTH_UNDEFINED, name: 'FCP'},
  {key: 'p75(measurements.fid)', width: COL_WIDTH_UNDEFINED, name: 'FID'},
  {key: 'p75(measurements.cls)', width: COL_WIDTH_UNDEFINED, name: 'CLS'},
  {key: 'p75(measurements.ttfb)', width: COL_WIDTH_UNDEFINED, name: 'TTFB'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Score'},
  {key: 'opportunity', width: COL_WIDTH_UNDEFINED, name: 'Opportunity'},
];

export function PagePerformanceTable() {
  const location = useLocation();
  const {projects} = useProjects();
  const [search, setSearch] = useState<string | undefined>(undefined);

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const {data: projectData, isLoading: isProjectWebVitalsQueryLoading} =
    useProjectWebVitalsQuery({transaction: search});

  const projectScore = calculatePerformanceScore({
    lcp: projectData?.data[0]['p75(measurements.lcp)'] as number,
    fcp: projectData?.data[0]['p75(measurements.fcp)'] as number,
    cls: projectData?.data[0]['p75(measurements.cls)'] as number,
    ttfb: projectData?.data[0]['p75(measurements.ttfb)'] as number,
    fid: projectData?.data[0]['p75(measurements.fid)'] as number,
  });

  const {data, isLoading: isTransactionWebVitalsQueryLoading} =
    useTransactionWebVitalsQuery({limit: 10, transaction: search});

  const count = projectData?.data[0]['count()'] as number;

  const tableData: RowWithScoreAndOpportunity[] = data
    .map(row => ({
      ...row,
      opportunity: calculateOpportunity(
        projectScore.totalScore,
        count,
        row.score,
        row['count()']
      ),
    }))
    .sort((a, b) => b.opportunity - a.opportunity);
  const getFormattedDuration = (value: number) => {
    return getDuration(value, value < 1 ? 0 : 2, true);
  };

  function renderHeadCell(col: Column) {
    if (
      [
        'p75(measurements.fcp)',
        'p75(measurements.lcp)',
        'p75(measurements.ttfb)',
        'p75(measurements.fid)',
        'p75(measurements.cls)',
        'count()',
      ].includes(col.key)
    ) {
      return (
        <AlignRight>
          <span>{col.name}</span>
        </AlignRight>
      );
    }
    if (col.key === 'score') {
      return (
        <AlignCenter>
          <span>{col.name}</span>
        </AlignCenter>
      );
    }
    if (col.key === 'opportunity') {
      return (
        <Tooltip
          title={t(
            'The biggest opportunities to improve your cumulative performance score.'
          )}
        >
          <OpportunityHeader>{col.name}</OpportunityHeader>
        </Tooltip>
      );
    }
    return <span>{col.name}</span>;
  }

  function renderBodyCell(col: Column, row: RowWithScoreAndOpportunity) {
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
    if (
      [
        'p75(measurements.fcp)',
        'p75(measurements.lcp)',
        'p75(measurements.ttfb)',
        'p75(measurements.fid)',
      ].includes(key)
    ) {
      return <AlignRight>{getFormattedDuration((row[key] as number) / 1000)}</AlignRight>;
    }
    if (['p75(measurements.cls)', 'opportunity'].includes(key)) {
      return <AlignRight>{Math.round((row[key] as number) * 100) / 100}</AlignRight>;
    }
    return <NoOverflow>{row[key]}</NoOverflow>;
  }

  return (
    <span>
      <SearchBarContainer>
        <SearchBar
          placeholder={t('Search for Pages')}
          onSearch={query => {
            setSearch(query === '' ? undefined : query);
          }}
        />
      </SearchBarContainer>
      <GridContainer>
        <GridEditable
          isLoading={isProjectWebVitalsQueryLoading || isTransactionWebVitalsQueryLoading}
          columnOrder={columnOrder}
          columnSortBy={[]}
          data={tableData}
          grid={{
            renderHeadCell,
            renderBodyCell,
          }}
          location={location}
        />
      </GridContainer>
    </span>
  );
}

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

const StyledProjectAvatar = styled(ProjectAvatar)`
  top: ${space(0.25)};
  position: relative;
  padding-right: ${space(1)};
`;

const SearchBarContainer = styled('div')`
  margin-bottom: ${space(1)};
`;

const GridContainer = styled('div')`
  margin-bottom: ${space(1)};
`;

const OpportunityHeader = styled('span')`
  ${p => p.theme.tooltipUnderline()};
`;
