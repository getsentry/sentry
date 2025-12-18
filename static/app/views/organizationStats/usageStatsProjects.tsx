import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {LocationDescriptorObject} from 'history';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import type {
  Alignments,
  Directions,
} from 'sentry/components/tables/gridEditable/sortLink';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import {DATA_CATEGORY_INFO, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategoryInfo} from 'sentry/types/core';
import {DataCategoryExact, Outcome} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import type {UsageSeries} from './types';
import type {TableStat} from './usageTable';
import UsageTable, {CellProject, CellStat} from './usageTable';
import {getOffsetFromCursor, getPaginationPageLink} from './utils';

type Props = {
  dataCategory: DataCategoryInfo;
  dataCategoryName: string;
  dataDatetime: DateTimeObject;
  getNextLocations: (project: Project) => Record<string, LocationDescriptorObject>;
  handleChangeState: (
    nextState: {
      cursor?: string;
      query?: string;
      sort?: string;
    },
    options?: {willUpdateRouter?: boolean}
  ) => LocationDescriptorObject;
  isSingleProject: boolean;
  projectIds: number[];
  tableCursor?: string;
  tableQuery?: string;
  tableSort?: string;
};

const MAX_ROWS_USAGE_TABLE = 25;

enum SortBy {
  PROJECT = 'project',
  TOTAL = 'total',
  ACCEPTED = 'accepted',
  ACCEPTED_STORED = 'accepted_stored',
  FILTERED = 'filtered',
  INVALID = 'invalid',
  RATE_LIMITED = 'rate_limited',
}

export function UsageStatsProjects({
  dataDatetime,
  dataCategory,
  projectIds,
  isSingleProject,
  tableQuery,
  handleChangeState,
  tableCursor,
  getNextLocations,
  tableSort: parentTableSort,
}: Props) {
  const organization = useOrganization();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const endpointQuery = useMemo(() => {
    const queryDatetime =
      dataDatetime.start && dataDatetime.end
        ? {
            start: dataDatetime.start,
            end: dataDatetime.end,
            utc: dataDatetime.utc,
          }
        : {
            statsPeriod: dataDatetime.period || DEFAULT_STATS_PERIOD,
          };

    const groupBy = ['outcome', 'project'];
    const category: string[] = [dataCategory.name];

    if (
      hasDynamicSamplingCustomFeature(organization) &&
      dataCategory.name === DataCategoryExact.SPAN
    ) {
      groupBy.push('category');
      category.push(DataCategoryExact.SPAN_INDEXED);
    }

    // We do not need more granularity in the data so interval is '1d'
    return {
      ...queryDatetime,
      interval: getSeriesApiInterval(dataDatetime),
      groupBy,
      field: ['sum(quantity)'],
      // If only one project is in selected, display the entire project list
      project: isSingleProject ? [ALL_ACCESS_PROJECTS] : projectIds,
      category,
    };
  }, [organization, dataDatetime, dataCategory, isSingleProject, projectIds]);

  const {
    data: projectStats,
    isError,
    error,
    isPending: loading,
  } = useApiQuery<UsageSeries>(
    [
      `/organizations/${organization.slug}/stats_v2/`,
      {
        // We do not need more granularity in the data so interval is '1d'
        query: endpointQuery,
      },
    ],
    {
      staleTime: Infinity,
    }
  );

  const tableSort: {
    direction: number;
    key: SortBy;
  } = useMemo(() => {
    if (!parentTableSort) {
      return {
        key: SortBy.TOTAL,
        direction: 1,
      };
    }

    let key: string = parentTableSort;
    let direction = -1;

    if (parentTableSort.charAt(0) === '-') {
      key = key.slice(1);
      direction = 1;
    }

    switch (key) {
      case SortBy.PROJECT:
      case SortBy.TOTAL:
      case SortBy.ACCEPTED:
      case SortBy.FILTERED:
      case SortBy.INVALID:
      case SortBy.RATE_LIMITED:
        return {key, direction};
      default:
        return {key: SortBy.ACCEPTED, direction: -1};
    }
  }, [parentTableSort]);

  const handleSearch = useCallback(
    (query: string) => {
      if (query === tableQuery) {
        return;
      }

      if (!query) {
        handleChangeState({query: undefined, cursor: undefined});
        return;
      }

      handleChangeState({query, cursor: undefined});
    },
    [tableQuery, handleChangeState]
  );

  const handleChangeSort = useCallback(
    (nextKey: SortBy) => {
      const {key, direction} = tableSort;

      let nextDirection = 1; // Default to descending

      if (key === nextKey) {
        nextDirection = direction * -1; // Toggle if clicking on the same column
      } else if (nextKey === SortBy.PROJECT) {
        nextDirection = -1; // Default PROJECT to ascending
      }

      // The header uses SortLink, which takes a LocationDescriptor and pushes
      // that to the router. As such, we do not need to update the router in
      // handleChangeState
      return handleChangeState(
        {sort: `${nextDirection > 0 ? '-' : ''}${nextKey}`},
        {willUpdateRouter: false}
      );
    },
    [tableSort, handleChangeState]
  );

  const projectSelectionFilter = useCallback(
    (p: Project) => {
      const selectedProjects = new Set(projectIds.map(id => `${id}`));

      return selectedProjects.size === 0 || selectedProjects.has('-1') || isSingleProject
        ? true
        : selectedProjects.has(p.id);
    },
    [projectIds, isSingleProject]
  );

  /**
   * Filter projects if there's a query
   */
  const filteredProjects = useMemo(() => {
    return tableQuery
      ? projects.filter(
          p => p.slug.includes(tableQuery) && p.hasAccess && projectSelectionFilter(p)
        )
      : projects.filter(p => p.hasAccess && projectSelectionFilter(p));
  }, [projects, tableQuery, projectSelectionFilter]);

  const getProjectLink = useCallback(
    (project: Project) => {
      const {performance, projectDetail, settings} = getNextLocations(project);

      if (
        dataCategory === DATA_CATEGORY_INFO.transaction &&
        organization.features.includes('performance-view')
      ) {
        return {
          projectLink: performance,
          projectSettingsLink: settings,
        };
      }

      return {
        projectLink: projectDetail,
        projectSettingsLink: settings,
      };
    },
    [organization, dataCategory, getNextLocations]
  );

  const tableOffset = useMemo(() => {
    return getOffsetFromCursor(tableCursor);
  }, [tableCursor]);

  const seriesData = useMemo(() => {
    if (!projectStats) {
      return {tableStats: [], hasStoredOutcome: false};
    }

    const stats: Record<string | number, any> = {};

    try {
      const baseStat: Partial<TableStat> = {
        [SortBy.TOTAL]: 0,
        [SortBy.ACCEPTED]: 0,
        [SortBy.ACCEPTED_STORED]: 0,
        [SortBy.FILTERED]: 0,
        [SortBy.INVALID]: 0,
        [SortBy.RATE_LIMITED]: 0,
      };

      const projectList = filteredProjects;
      const projectSet = new Set(projectList.map(p => p.id));

      projectStats.groups.forEach(group => {
        const {outcome, category, project: projectId} = group.by;
        // Backend enum is singlar. Frontend enum is plural.

        if (category === 'span_indexed' && outcome !== Outcome.ACCEPTED) {
          // we need `span_indexed` data for `accepted_stored` only
          return;
        }

        if (!projectSet.has(projectId!.toString())) {
          return;
        }

        if (!stats[projectId!]) {
          stats[projectId!] = {...baseStat};
        }

        if (outcome !== Outcome.CLIENT_DISCARD && category !== 'span_indexed') {
          stats[projectId!]!.total += group.totals['sum(quantity)']!;
        }

        if (category === 'span_indexed' && outcome === Outcome.ACCEPTED) {
          stats[projectId!]!.accepted_stored += group.totals['sum(quantity)']!;
          return;
        }

        if (
          outcome === Outcome.ACCEPTED ||
          outcome === Outcome.FILTERED ||
          outcome === Outcome.INVALID
        ) {
          stats[projectId!]![outcome] += group.totals['sum(quantity)']!;
        }

        if (
          outcome === Outcome.RATE_LIMITED ||
          outcome === Outcome.CARDINALITY_LIMITED ||
          outcome === Outcome.ABUSE
        ) {
          stats[projectId!]![SortBy.RATE_LIMITED] += group.totals['sum(quantity)']!;
        }
      });

      // For projects without stats, fill in with zero
      let hasStoredOutcome = false;
      const tableStats: TableStat[] = projectList.map(proj => {
        const stat = stats[proj.id] ?? {...baseStat};
        if (
          stat[SortBy.ACCEPTED_STORED] > 0 &&
          stat[SortBy.ACCEPTED_STORED] !== stat[SortBy.ACCEPTED]
        ) {
          hasStoredOutcome = true;
        }
        return {
          project: {...proj},
          ...getProjectLink(proj),
          ...stat,
        };
      });

      const {key, direction} = tableSort;
      tableStats.sort((a, b) => {
        if (key === SortBy.PROJECT) {
          return b.project.slug.localeCompare(a.project.slug) * direction;
        }

        return a[key] === b[key]
          ? a.project.slug.localeCompare(b.project.slug)
          : (b[key] - a[key]) * direction;
      });

      const offset = tableOffset;

      return {
        tableStats: tableStats.slice(offset, offset + MAX_ROWS_USAGE_TABLE),
        hasStoredOutcome,
      };
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setContext('query', endpointQuery);
        scope.setContext('body', {...projectStats});
        Sentry.captureException(err);
      });

      return {
        tableStats: [],
        hasStoredOutcome: false,
        error: err,
      };
    }
  }, [
    endpointQuery,
    filteredProjects,
    projectStats,
    tableSort,
    tableOffset,
    getProjectLink,
  ]);

  const getTableHeader = useCallback(
    ({showStoredOutcome}: {showStoredOutcome: boolean}) => {
      const {key, direction} = tableSort;

      const getArrowDirection = (linkKey: SortBy): Directions => {
        if (linkKey !== key) {
          return undefined;
        }

        return direction > 0 ? 'desc' : 'asc';
      };

      return [
        {
          key: SortBy.PROJECT,
          title: t('Project'),
          align: 'left',
          direction: getArrowDirection(SortBy.PROJECT),
          onClick: () => handleChangeSort(SortBy.PROJECT),
        },
        {
          key: SortBy.TOTAL,
          title: t('Total'),
          align: 'right',
          direction: getArrowDirection(SortBy.TOTAL),
          onClick: () => handleChangeSort(SortBy.TOTAL),
        },
        {
          key: SortBy.ACCEPTED,
          title: showStoredOutcome ? t('Accepted (Stored)') : t('Accepted'),
          align: 'right',
          direction: getArrowDirection(SortBy.ACCEPTED),
          onClick: () => handleChangeSort(SortBy.ACCEPTED),
        },
        {
          key: SortBy.FILTERED,
          title: t('Filtered'),
          align: 'right',
          direction: getArrowDirection(SortBy.FILTERED),
          onClick: () => handleChangeSort(SortBy.FILTERED),
        },
        {
          key: SortBy.RATE_LIMITED,
          title: t('Rate Limited'),
          align: 'right',
          direction: getArrowDirection(SortBy.RATE_LIMITED),
          onClick: () => handleChangeSort(SortBy.RATE_LIMITED),
        },
        {
          key: SortBy.INVALID,
          title: t('Invalid'),
          align: 'right',
          direction: getArrowDirection(SortBy.INVALID),
          onClick: () => handleChangeSort(SortBy.INVALID),
        },
      ]
        .map(h => {
          const Cell = h.key === SortBy.PROJECT ? CellProject : CellStat;

          return (
            <Cell key={h.key}>
              <SortLink
                canSort
                title={h.title}
                align={h.align as Alignments}
                direction={h.direction}
                generateSortLink={h.onClick}
              />
            </Cell>
          );
        })
        .concat([<CellStat key="empty" />]); // Extra column for displaying buttons etc.
    },
    [handleChangeSort, tableSort]
  );

  const tableData = useMemo(() => {
    const showStoredOutcome =
      hasDynamicSamplingCustomFeature(organization) &&
      dataCategory.name === DataCategoryExact.SPAN &&
      seriesData.hasStoredOutcome;

    return {
      headers: getTableHeader({showStoredOutcome}),
      showStoredOutcome,
      ...seriesData,
    };
  }, [organization, dataCategory, seriesData, getTableHeader]);

  /**
   * OrganizationStatsEndpointV2 does not have any performance issues. We use
   * client-side pagination to limit the number of rows on the table so the
   * page doesn't scroll too deeply for organizations with a lot of projects
   */
  const pageLink = useMemo(() => {
    const offset = tableOffset;
    const numRows = filteredProjects.length;
    return getPaginationPageLink({
      numRows,
      pageSize: MAX_ROWS_USAGE_TABLE,
      offset,
    });
  }, [tableOffset, filteredProjects]);

  const {headers, tableStats, showStoredOutcome} = tableData;

  return (
    <Fragment>
      {isSingleProject && (
        <PanelHeading>
          <Title>{t('All Projects')}</Title>
        </PanelHeading>
      )}
      {!isSingleProject && (
        <Container>
          <SearchBar
            defaultQuery=""
            query={tableQuery}
            placeholder={t('Filter your projects')}
            aria-label={t('Filter projects')}
            onSearch={handleSearch}
          />
        </Container>
      )}
      <Container data-test-id="usage-stats-table">
        <UsageTable
          isLoading={loading || !projectsLoaded}
          isError={isError}
          errors={error ? {projectStats: error} : undefined}
          isEmpty={tableStats.length === 0}
          headers={headers}
          dataCategory={dataCategory}
          usageStats={tableStats}
          showStoredOutcome={showStoredOutcome}
        />
        <Pagination pageLinks={pageLink} />
      </Container>
    </Fragment>
  );
}

const Container = styled('div')`
  margin-bottom: ${space(2)};
`;

const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.lg};
  color: ${p => p.theme.colors.gray500};
  display: flex;
  flex: 1;
  align-items: center;
`;

const PanelHeading = styled('div')`
  display: flex;
  margin-bottom: ${space(2)};
  align-items: center;
`;
