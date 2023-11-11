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
import {Sort} from 'sentry/utils/discover/fields';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {calculateOpportunity} from 'sentry/views/performance/browser/webVitals/utils/calculateOpportunity';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {
  Row,
  SORTABLE_FIELDS,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {useTransactionWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useTransactionWebVitalsQuery';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';

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

const MAX_ROWS = 25;

export function PagePerformanceTable() {
  const organization = useOrganization();
  const location = useLocation();
  const {projects} = useProjects();

  const query = decodeScalar(location.query.query, '');

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const sort = useWebVitalsSort();

  const {data: projectData, isLoading: isProjectWebVitalsQueryLoading} =
    useProjectWebVitalsQuery({transaction: query});

  const projectScore = calculatePerformanceScore({
    lcp: projectData?.data[0]['p75(measurements.lcp)'] as number,
    fcp: projectData?.data[0]['p75(measurements.fcp)'] as number,
    cls: projectData?.data[0]['p75(measurements.cls)'] as number,
    ttfb: projectData?.data[0]['p75(measurements.ttfb)'] as number,
    fid: projectData?.data[0]['p75(measurements.fid)'] as number,
  });

  const {
    data,
    pageLinks,
    isLoading: isTransactionWebVitalsQueryLoading,
  } = useTransactionWebVitalsQuery({limit: MAX_ROWS, transaction: query});

  const count = projectData?.data[0]['count()'] as number;

  const tableData: RowWithScoreAndOpportunity[] = data.map(row => ({
    ...row,
    opportunity: calculateOpportunity(
      projectScore.totalScore ?? 0,
      count,
      row.score,
      row['count()']
    ),
  }));
  const getFormattedDuration = (value: number) => {
    return getDuration(value, value < 1 ? 0 : 2, true);
  };

  function renderHeadCell(col: Column) {
    function generateSortLink() {
      let newSortDirection: Sort['kind'] = 'desc';
      if (sort?.field === col.key) {
        if (sort.kind === 'desc') {
          newSortDirection = 'asc';
        }
      }

      const newSort = `${newSortDirection === 'desc' ? '-' : ''}${col.key}`;

      return {
        ...location,
        query: {...location.query, sort: newSort},
      };
    }

    const canSort = (SORTABLE_FIELDS as unknown as string[]).includes(col.key);

    if (canSort) {
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
    if (col.key === 'score') {
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
            <TooltipHeader>{t('Perf Score')}</TooltipHeader>
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
            <TooltipHeader>{col.name}</TooltipHeader>
          </StyledTooltip>
        </AlignRight>
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
              query: {...location.query, transaction: row.transaction, query: undefined},
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
      return <AlignRight>{getFormattedDuration((row[key] as number) / 1000)}</AlignRight>;
    }
    if (['p75(measurements.cls)', 'opportunity'].includes(key)) {
      return <AlignRight>{Math.round((row[key] as number) * 100) / 100}</AlignRight>;
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
          disabled={isProjectWebVitalsQueryLoading || isTransactionWebVitalsQueryLoading}
          size="md"
        />
        {/* The Pagination component disappears if pageLinks is not defined,
        which happens any time the table data is loading. So we render a
        disabled button bar if pageLinks is not defined to minimize ui shifting */}
        {!pageLinks && (
          <Wrapper>
            <ButtonBar merged>
              <Button
                icon={<IconChevron direction="left" size="sm" />}
                size="md"
                disabled
                aria-label={t('Previous')}
              />
              <Button
                icon={<IconChevron direction="right" size="sm" />}
                size="md"
                disabled
                aria-label={t('Next')}
              />
            </ButtonBar>
          </Wrapper>
        )}
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
