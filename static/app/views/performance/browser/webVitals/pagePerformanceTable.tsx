import {useMemo} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {GridColumnHeader, GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';
import type {Sort} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import {escapeFilterValue} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {useTransactionWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/useTransactionWebVitalsQuery';
import type {RowWithScoreAndOpportunity} from 'sentry/views/performance/browser/webVitals/utils/types';
import {SORTABLE_FIELDS} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';

type Column = GridColumnHeader<keyof RowWithScoreAndOpportunity>;

const COLUMN_ORDER: GridColumnOrder<keyof RowWithScoreAndOpportunity>[] = [
  {key: 'transaction', width: COL_WIDTH_UNDEFINED, name: 'Pages'},
  {key: 'count()', width: COL_WIDTH_UNDEFINED, name: 'Pageloads'},
  {key: 'p75(measurements.lcp)', width: COL_WIDTH_UNDEFINED, name: 'LCP'},
  {key: 'p75(measurements.fcp)', width: COL_WIDTH_UNDEFINED, name: 'FCP'},
  {
    key: 'p75(measurements.inp)',
    width: COL_WIDTH_UNDEFINED,
    name: 'INP',
  },
  {key: 'p75(measurements.cls)', width: COL_WIDTH_UNDEFINED, name: 'CLS'},
  {key: 'p75(measurements.ttfb)', width: COL_WIDTH_UNDEFINED, name: 'TTFB'},
  {key: 'totalScore', width: COL_WIDTH_UNDEFINED, name: 'Score'},
  {key: 'opportunity', width: COL_WIDTH_UNDEFINED, name: 'Opportunity'},
];

const MAX_ROWS = 25;

const DEFAULT_SORT: Sort = {
  field: 'opportunity_score(measurements.score.total)',
  kind: 'desc',
};

export function PagePerformanceTable() {
  const location = useLocation();
  const {projects} = useProjects();

  const columnOrder = COLUMN_ORDER;

  const query = decodeScalar(location.query.query, '');

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  let sort = useWebVitalsSort({defaultSort: DEFAULT_SORT});
  // Need to map fid back to inp for rendering
  if (sort.field === 'p75(measurements.fid)') {
    sort = {...sort, field: 'p75(measurements.inp)'};
  }
  const {data: projectScoresData, isLoading: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery();

  const {
    data,
    pageLinks,
    isLoading: isTransactionWebVitalsQueryLoading,
  } = useTransactionWebVitalsQuery({
    limit: MAX_ROWS,
    transaction: `*${escapeFilterValue(query)}*`,
    defaultSort: DEFAULT_SORT,
    shouldEscapeFilters: false,
  });

  const scoreCount = projectScoresData?.data?.[0]?.[
    'count_scores(measurements.score.total)'
  ] as number;

  const tableData: RowWithScoreAndOpportunity[] = data.map(row => ({
    ...row,
    opportunity:
      (((row as RowWithScoreAndOpportunity).opportunity ?? 0) * 100) / scoreCount,
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
    const sortableFields = SORTABLE_FIELDS;
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
            <SortLink
              title={<TooltipHeader>{t('Perf Score')}</TooltipHeader>}
              direction={sort?.field === col.key ? sort.kind : undefined}
              canSort={canSort}
              generateSortLink={generateSortLink}
              align={undefined}
            />
          </StyledTooltip>
        </AlignCenter>
      );
    }
    if (col.key === 'opportunity') {
      return (
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
            <SortLink
              align="right"
              title={<TooltipHeader>{col.name}</TooltipHeader>}
              direction={sort?.field === col.key ? sort.kind : undefined}
              canSort={canSort}
              generateSortLink={generateSortLink}
            />
          </StyledTooltip>
        </AlignRight>
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
              pathname: `${location.pathname}overview/`,
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
        'p75(measurements.inp)',
      ].includes(key)
    ) {
      const measurement = parseFunction(key)?.arguments?.[0];
      const func = 'count_scores';
      const args = [measurement?.replace('measurements.', 'measurements.score.')];
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
      const countWebVitalKey = 'count_scores(measurements.score.cls)';
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
        query: newQuery === '' ? undefined : newQuery,
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
          defaultQuery={query}
        />
        <StyledPagination
          pageLinks={pageLinks}
          disabled={isProjectScoresLoading || isTransactionWebVitalsQueryLoading}
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
          isLoading={isProjectScoresLoading || isTransactionWebVitalsQueryLoading}
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
