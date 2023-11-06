import {useMemo} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SearchBar from 'sentry/components/events/searchBar';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import ExternalLink from 'sentry/components/links/externalLink';
import Pagination from 'sentry/components/pagination';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconPlay, IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {Sort} from 'sentry/utils/discover/fields';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {getDuration} from 'sentry/utils/formatters';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {useRoutes} from 'sentry/utils/useRoutes';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {
  DEFAULT_INDEXED_SORT,
  SORTABLE_INDEXED_FIELDS,
  TransactionSampleRow,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useTransactionSamplesWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useTransactionSamplesWebVitalsQuery';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';
import {generateReplayLink} from 'sentry/views/performance/transactionSummary/utils';

export type TransactionSampleRowWithScoreAndExtra = TransactionSampleRow & {
  score: number;
};

type Column = GridColumnHeader<keyof TransactionSampleRowWithScoreAndExtra>;

export const COLUMN_ORDER: GridColumnOrder<
  keyof TransactionSampleRowWithScoreAndExtra
>[] = [
  {key: 'user.display', width: COL_WIDTH_UNDEFINED, name: 'User'},
  {key: 'transaction.duration', width: COL_WIDTH_UNDEFINED, name: 'Duration'},
  {key: 'measurements.lcp', width: COL_WIDTH_UNDEFINED, name: 'LCP'},
  {key: 'measurements.fcp', width: COL_WIDTH_UNDEFINED, name: 'FCP'},
  {key: 'measurements.fid', width: COL_WIDTH_UNDEFINED, name: 'FID'},
  {key: 'measurements.cls', width: COL_WIDTH_UNDEFINED, name: 'CLS'},
  {key: 'measurements.ttfb', width: COL_WIDTH_UNDEFINED, name: 'TTFB'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Score'},
];

type Props = {
  transaction: string;
  columnOrder?: GridColumnOrder<keyof TransactionSampleRowWithScoreAndExtra>[];
  limit?: number;
  search?: string;
};

export function PageSamplePerformanceTable({
  transaction,
  columnOrder,
  search,
  limit = 9,
}: Props) {
  const location = useLocation();
  const {projects} = useProjects();
  const organization = useOrganization();
  const routes = useRoutes();
  const router = useRouter();
  const sort = useWebVitalsSort({
    defaultSort: DEFAULT_INDEXED_SORT,
    sortableFields: SORTABLE_INDEXED_FIELDS as unknown as string[],
  });
  const replayLinkGenerator = generateReplayLink(routes);

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const query = decodeScalar(location.query.query);

  // Do 3 queries filtering on LCP to get a spread of good, meh, and poor events
  // We can't query by performance score yet, so we're using LCP as a best estimate
  const {data, isLoading, pageLinks} = useTransactionSamplesWebVitalsQuery({
    limit,
    transaction,
    query: search,
    withProfiles: true,
  });

  const tableData: TransactionSampleRowWithScoreAndExtra[] = data.map(row => ({
    ...row,
    view: null,
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

    const canSort = (SORTABLE_INDEXED_FIELDS as ReadonlyArray<string>).includes(col.key);

    if (
      [
        'measurements.fcp',
        'measurements.lcp',
        'measurements.ttfb',
        'measurements.fid',
        'measurements.cls',
        'transaction.duration',
      ].includes(col.key)
    ) {
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
      return (
        <AlignRight>
          <span>{col.name}</span>
        </AlignRight>
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
    if (col.key === 'replayId' || col.key === 'profile.id') {
      return (
        <AlignCenter>
          <span>{col.name}</span>
        </AlignCenter>
      );
    }
    return <span>{col.name}</span>;
  }

  function renderBodyCell(col: Column, row: TransactionSampleRowWithScoreAndExtra) {
    const {key} = col;
    if (key === 'score') {
      return (
        <AlignCenter>
          <PerformanceBadge score={row.score} />
        </AlignCenter>
      );
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
            to={{...location, query: {...location.query, transaction: row.transaction}}}
          >
            {row.transaction}
          </Link>
        </NoOverflow>
      );
    }
    if (
      [
        'measurements.fcp',
        'measurements.lcp',
        'measurements.ttfb',
        'measurements.fid',
        'transaction.duration',
      ].includes(key)
    ) {
      return (
        <AlignRight>
          {row[key] === null ? (
            <NoValue>{' \u2014 '}</NoValue>
          ) : (
            getFormattedDuration((row[key] as number) / 1000)
          )}
        </AlignRight>
      );
    }
    if (['measurements.cls', 'opportunity'].includes(key)) {
      return <AlignRight>{Math.round((row[key] as number) * 100) / 100}</AlignRight>;
    }
    if (key === 'profile.id') {
      const profileTarget =
        defined(row.projectSlug) && defined(row['profile.id'])
          ? generateProfileFlamechartRoute({
              orgSlug: organization.slug,
              projectSlug: row.projectSlug,
              profileId: String(row['profile.id']),
            })
          : null;
      return (
        <NoOverflow>
          <AlignCenter>
            {profileTarget && (
              <Tooltip title={t('View Profile')}>
                <LinkButton to={profileTarget} size="xs">
                  <IconProfiling size="xs" />
                </LinkButton>
              </Tooltip>
            )}
          </AlignCenter>
        </NoOverflow>
      );
    }

    if (key === 'replayId') {
      const replayTarget =
        row['transaction.duration'] !== null &&
        replayLinkGenerator(
          organization,
          {
            replayId: row.replayId,
            id: row.id,
            'transaction.duration': row['transaction.duration'],
            timestamp: row.timestamp,
          },
          undefined
        );
      return (
        <NoOverflow>
          <AlignCenter>
            {replayTarget && (
              <Tooltip title={t('View Replay')}>
                <LinkButton to={replayTarget} size="xs">
                  <IconPlay size="xs" />
                </LinkButton>
              </Tooltip>
            )}
          </AlignCenter>
        </NoOverflow>
      );
    }

    if (key === 'id') {
      const eventSlug = generateEventSlug({...row, project: row.projectSlug});
      const eventTarget = getTransactionDetailsUrl(organization.slug, eventSlug);
      return (
        <NoOverflow>
          <Tooltip title={t('View Transaction')}>
            <Link to={eventTarget}>{getShortEventId(row.id)}</Link>
          </Tooltip>
        </NoOverflow>
      );
    }
    return <NoOverflow>{row[key]}</NoOverflow>;
  }

  return (
    <span>
      <SearchBarContainer>
        <StyledSearchBar
          query={query}
          organization={organization}
          onSearch={queryString =>
            router.replace({
              ...location,
              query: {...location.query, query: queryString},
            })
          }
        />
        <StyledPagination pageLinks={pageLinks} disabled={isLoading} size="md" />
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
          isLoading={isLoading}
          columnOrder={columnOrder ?? COLUMN_ORDER}
          columnSortBy={[]}
          data={tableData}
          grid={{
            renderHeadCell,
            renderBodyCell,
          }}
          location={location}
          minimumColWidth={70}
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

const AlignCenter = styled('div')`
  text-align: center;
  width: 100%;
`;

const StyledProjectAvatar = styled(ProjectAvatar)`
  top: ${space(0.25)};
  position: relative;
  padding-right: ${space(1)};
`;

// Not pretty but we need to override gridEditable styles since the original
// styles have too much padding for small spaces
const GridContainer = styled('div')`
  margin-bottom: ${space(1)};
  th {
    padding: 0 ${space(1)};
  }
  th:first-child {
    padding-left: ${space(2)};
  }
  th:last-child {
    padding-right: ${space(2)};
  }
  td {
    padding: ${space(1)};
  }
  td:first-child {
    padding-right: ${space(1)};
    padding-left: ${space(2)};
  }
`;

const NoValue = styled('span')`
  color: ${p => p.theme.gray300};
`;

const SearchBarContainer = styled('div')`
  display: flex;
  margin-top: ${space(2)};
  margin-bottom: ${space(1)};
  gap: ${space(1)};
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

const TooltipHeader = styled('span')`
  ${p => p.theme.tooltipUnderline()};
`;

const StyledTooltip = styled(Tooltip)`
  top: 1px;
  position: relative;
`;
