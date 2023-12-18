import {useMemo} from 'react';
import {browserHistory, Link} from 'react-router';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import ExternalLink from 'sentry/components/links/externalLink';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {parseFunction, Sort} from 'sentry/utils/discover/fields';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {calculateOpportunity} from 'sentry/views/performance/browser/webVitals/utils/calculateOpportunity';
import {calculatePerformanceScoreFromTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {useProjectRawWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {useTransactionWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/useTransactionWebVitalsQuery';
import {
  RowWithScoreAndOpportunity,
  SORTABLE_FIELDS,
  SORTABLE_SCORE_FIELDS,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';

type Column = GridColumnHeader<keyof RowWithScoreAndOpportunity>;

const columnOrder: GridColumnOrder<keyof RowWithScoreAndOpportunity>[] = [
  {key: 'transaction', width: COL_WIDTH_UNDEFINED, name: 'Pages'},
  {key: 'count()', width: COL_WIDTH_UNDEFINED, name: 'Pageloads'},
  {key: 'p75(measurements.lcp)', width: COL_WIDTH_UNDEFINED, name: 'LCP'},
  {key: 'p75(measurements.fcp)', width: COL_WIDTH_UNDEFINED, name: 'FCP'},
  {key: 'p75(measurements.fid)', width: COL_WIDTH_UNDEFINED, name: 'FID'},
  {key: 'p75(measurements.cls)', width: COL_WIDTH_UNDEFINED, name: 'CLS'},
  {key: 'p75(measurements.ttfb)', width: COL_WIDTH_UNDEFINED, name: 'TTFB'},
  {key: 'totalScore', width: COL_WIDTH_UNDEFINED, name: 'Score'},
  {key: 'opportunity', width: COL_WIDTH_UNDEFINED, name: 'Opportunity'},
];

const MAX_ROWS = 25;

export function PagePerformanceTable() {
  const organization = useOrganization();
  const location = useLocation();
  const {projects} = useProjects();
  const shouldUseStoredScores = useStoredScoresSetting();

  const query = decodeScalar(location.query.query, '');

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const sort = useWebVitalsSort();

  const {data: projectData, isLoading: isProjectWebVitalsQueryLoading} =
    useProjectRawWebVitalsQuery({transaction: query});
  const {data: projectScoresData, isLoading: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery({
      transaction: query,
      enabled: shouldUseStoredScores,
    });

  const projectScore = shouldUseStoredScores
    ? calculatePerformanceScoreFromStoredTableDataRow(projectScoresData?.data?.[0])
    : calculatePerformanceScoreFromTableDataRow(projectData?.data?.[0]);

  const {
    data,
    pageLinks,
    isLoading: isTransactionWebVitalsQueryLoading,
  } = useTransactionWebVitalsQuery({limit: MAX_ROWS, transaction: query});

  const count = projectData?.data?.[0]?.['count()'] as number;
  const scoreCount = projectScoresData?.data?.[0]?.[
    'count_scores(measurements.score.total)'
  ] as number;

  const tableData: RowWithScoreAndOpportunity[] = data.map(row => ({
    ...row,
    opportunity: shouldUseStoredScores
      ? (((row as RowWithScoreAndOpportunity).opportunity ?? 0) * 100) / scoreCount
      : calculateOpportunity(
          projectScore.totalScore ?? 0,
          count,
          row.totalScore,
          row['count()']
        ),
  }));
  const getFormattedDuration = (value: number) => {
    return getDuration(value, value < 1 ? 0 : 2, true);
  };

  function renderHeadCell(col: Column) {
    function generateSortLink() {
      const key =
        col.key === 'totalScore'
          ? 'avg(measurements.score.total)'
          : col.key === 'opportunity'
          ? 'opportunity_score(measurements.score.total)'
          : col.key;
      let newSortDirection: Sort['kind'] = 'desc';
      if (sort?.field === key) {
        if (sort.kind === 'desc') {
          newSortDirection = 'asc';
        }
      }

      const newSort = `${newSortDirection === 'desc' ? '-' : ''}${key}`;

      return {
        ...location,
        query: {...location.query, sort: newSort},
      };
    }
    const sortableFields = shouldUseStoredScores
      ? SORTABLE_FIELDS
      : SORTABLE_FIELDS.filter(field => !SORTABLE_SCORE_FIELDS.includes(field));
    const canSort = (sortableFields as unknown as string[]).includes(col.key);

    if (canSort && !['totalScore', 'opportunity'].includes(col.key)) {
      return (
        <SortLink
          align="right"
          title={col.name}
          direction={sort?.field === col.key ? sort.kind : undefined}
          canSort={canSort}
          generateSortLink={generateSortLink}
        />
      );
    }
    if (col.key === 'totalScore') {
      return (
        <SortLink
          title={
            <AlignCenter>
              <StyledTooltip
                isHoverable
                title={
                  <span>
                    {t('The overall performance rating of this page.')}
                    <br />
                    <ExternalLink href="https://docs.sentry.io/product/performance/web-vitals/#performance-score">
                      {t('How is this calculated?')}
                    </ExternalLink>
                  </span>
                }
              >
                <TooltipHeader>{t('Perf Score')}</TooltipHeader>
              </StyledTooltip>
            </AlignCenter>
          }
          direction={sort?.field === col.key ? sort.kind : undefined}
          canSort={canSort}
          generateSortLink={generateSortLink}
          align={undefined}
        />
      );
    }
    if (col.key === 'opportunity') {
      return (
        <SortLink
          align="right"
          title={
            <AlignRight>
              <StyledTooltip
                isHoverable
                title={
                  <span>
                    {t(
                      "A number rating how impactful a performance improvement on this page would be to your application's overall Performance Score."
                    )}
                    <br />
                    <ExternalLink href="https://docs.sentry.io/product/performance/web-vitals/#opportunity">
                      {t('How is this calculated?')}
                    </ExternalLink>
                  </span>
                }
              >
                <TooltipHeader>{col.name}</TooltipHeader>
              </StyledTooltip>
            </AlignRight>
          }
          direction={sort?.field === col.key ? sort.kind : undefined}
          canSort={canSort}
          generateSortLink={generateSortLink}
        />
      );
    }
    return <span>{col.name}</span>;
  }

  function renderBodyCell(col: Column, row: RowWithScoreAndOpportunity) {
    const {key} = col;
    if (key === 'totalScore') {
      return (
        <AlignCenter>
          <PerformanceBadge score={row.totalScore} />
        </AlignCenter>
      );
    }
    if (key === 'count()') {
      return <AlignRight>{formatAbbreviatedNumber(row['count()'])}</AlignRight>;
    }
    if (key === 'transaction') {
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
          <Link
            to={{
              ...location,
              ...(organization.features.includes(
                'starfish-browser-webvitals-pageoverview-v2'
              )
                ? {pathname: `${location.pathname}overview/`}
                : {}),
              query: {
                ...location.query,
                transaction: row.transaction,
                query: undefined,
                cursor: undefined,
              },
            }}
          >
            {row.transaction}
          </Link>
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
      const measurement = parseFunction(key)?.arguments?.[0];
      const func = shouldUseStoredScores ? 'count_scores' : 'count_web_vitals';
      const args = [measurement, ...(shouldUseStoredScores ? [] : ['any'])];
      const countWebVitalKey = `${func}(${args.join(', ')})`;
      const countWebVital = row[countWebVitalKey];
      if (measurement === undefined || countWebVital === 0) {
        return (
          <AlignRight>
            <NoValue>{' \u2014 '}</NoValue>
          </AlignRight>
        );
      }
      return <AlignRight>{getFormattedDuration((row[key] as number) / 1000)}</AlignRight>;
    }
    if (key === 'p75(measurements.cls)') {
      const countWebVitalKey = shouldUseStoredScores
        ? 'count_scores(measurements.score.cls)'
        : 'count_web_vitals(measurements.cls, any)';
      const countWebVital = row[countWebVitalKey];
      if (countWebVital === 0) {
        return (
          <AlignRight>
            <NoValue>{' \u2014 '}</NoValue>
          </AlignRight>
        );
      }
      return <AlignRight>{Math.round((row[key] as number) * 100) / 100}</AlignRight>;
    }
    if (key === 'opportunity') {
      if (row.opportunity !== undefined) {
        return (
          <AlignRight>{Math.round((row.opportunity as number) * 100) / 100}</AlignRight>
        );
      }
      return null;
    }
    return <NoOverflow>{row[key]}</NoOverflow>;
  }

  const handleSearch = (newQuery: string) => {
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        query: newQuery === '' ? undefined : `*${newQuery}*`,
        cursor: undefined,
      },
    });
  };

  return (
    <span>
      <SearchBarContainer>
        <StyledSearchBar
          placeholder={t('Search for more Pages')}
          onSearch={handleSearch}
        />
        <StyledPagination
          pageLinks={pageLinks}
          disabled={
            (shouldUseStoredScores && isProjectScoresLoading) ||
            isProjectWebVitalsQueryLoading ||
            isTransactionWebVitalsQueryLoading
          }
          size="md"
        />
        {/* The Pagination component disappears if pageLinks is not defined,
        which happens any time the table data is loading. So we render a
        disabled button bar if pageLinks is not defined to minimize ui shifting */}
        {!pageLinks && (
          <Wrapper>
            <ButtonBar merged>
              <Button
                icon={<IconChevron direction="left" />}
                disabled
                aria-label={t('Previous')}
              />
              <Button
                icon={<IconChevron direction="right" />}
                disabled
                aria-label={t('Next')}
              />
            </ButtonBar>
          </Wrapper>
        )}
      </SearchBarContainer>
      <GridContainer>
        <GridEditable
          isLoading={
            (shouldUseStoredScores && isProjectScoresLoading) ||
            isProjectWebVitalsQueryLoading ||
            isTransactionWebVitalsQueryLoading
          }
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
  display: block;
  margin: auto;
  text-align: center;
  width: 100%;
`;

const StyledProjectAvatar = styled(ProjectAvatar)`
  top: ${space(0.25)};
  position: relative;
  padding-right: ${space(1)};
`;

const SearchBarContainer = styled('div')`
  display: flex;
  margin-bottom: ${space(1)};
  gap: ${space(1)};
`;

const GridContainer = styled('div')`
  margin-bottom: ${space(1)};
`;

const TooltipHeader = styled('span')`
  ${p => p.theme.tooltipUnderline()};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin: 0;
`;

const StyledTooltip = styled(Tooltip)`
  top: 1px;
  position: relative;
`;

const NoValue = styled('span')`
  color: ${p => p.theme.gray300};
`;
