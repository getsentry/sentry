import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {LocationDescriptorObject} from 'history';
import isEqual from 'lodash/isEqual';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import type {Alignments, Directions} from 'sentry/components/gridEditable/sortLink';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import {DATA_CATEGORY_INFO, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategoryInfo} from 'sentry/types/core';
import {Outcome} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import withProjects from 'sentry/utils/withProjects';

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
  loadingProjects: boolean;
  organization: Organization;
  projectIds: number[];
  projects: Project[];
  tableCursor?: string;
  tableQuery?: string;
  tableSort?: string;
} & DeprecatedAsyncComponent['props'];

type State = {
  projectStats: UsageSeries | undefined;
} & DeprecatedAsyncComponent['state'];

export enum SortBy {
  PROJECT = 'project',
  TOTAL = 'total',
  ACCEPTED = 'accepted',
  ACCEPTED_STORED = 'accepted_stored',
  FILTERED = 'filtered',
  INVALID = 'invalid',
  RATE_LIMITED = 'rate_limited',
}

class UsageStatsProjects extends DeprecatedAsyncComponent<Props, State> {
  static MAX_ROWS_USAGE_TABLE = 25;

  componentDidUpdate(prevProps: Props) {
    const {
      dataDatetime: prevDateTime,
      dataCategory: prevDataCategory,
      projectIds: prevProjectIds,
    } = prevProps;
    const {
      dataDatetime: currDateTime,
      dataCategory: currDataCategory,
      projectIds: currProjectIds,
    } = this.props;

    if (
      prevDateTime.start !== currDateTime.start ||
      prevDateTime.end !== currDateTime.end ||
      prevDateTime.period !== currDateTime.period ||
      prevDateTime.utc !== currDateTime.utc ||
      prevDataCategory !== currDataCategory ||
      !isEqual(prevProjectIds, currProjectIds)
    ) {
      this.reloadData();
    }
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [['projectStats', this.endpointPath, {query: this.endpointQuery}]];
  }

  get endpointPath() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/stats_v2/`;
  }

  get endpointQuery() {
    const {dataDatetime, dataCategory, projectIds, isSingleProject} = this.props;

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
    const category: string[] = [dataCategory.apiName];

    if (
      hasDynamicSamplingCustomFeature(this.props.organization) &&
      dataCategory.apiName === 'span'
    ) {
      groupBy.push('category');
      category.push('span_indexed');
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
  }

  get tableData() {
    const {projectStats} = this.state;
    const seriesData = this.mapSeriesToTable(projectStats);

    const showStoredOutcome =
      hasDynamicSamplingCustomFeature(this.props.organization) &&
      this.props.dataCategory.apiName === 'span' &&
      seriesData.hasStoredOutcome;

    return {
      headers: this.getTableHeader({showStoredOutcome}),
      showStoredOutcome,
      ...seriesData,
    };
  }

  get tableSort(): {
    direction: number;
    key: SortBy;
  } {
    const {tableSort} = this.props;

    if (!tableSort) {
      return {
        key: SortBy.TOTAL,
        direction: 1,
      };
    }

    let key: string = tableSort;
    let direction: number = -1;

    if (tableSort.charAt(0) === '-') {
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
  }

  get tableOffset() {
    const {tableCursor} = this.props;
    return getOffsetFromCursor(tableCursor);
  }

  /**
   * OrganizationStatsEndpointV2 does not have any performance issues. We use
   * client-side pagination to limit the number of rows on the table so the
   * page doesn't scroll too deeply for organizations with a lot of projects
   */
  get pageLink() {
    const offset = this.tableOffset;
    const numRows = this.filteredProjects.length;

    return getPaginationPageLink({
      numRows,
      pageSize: UsageStatsProjects.MAX_ROWS_USAGE_TABLE,
      offset,
    });
  }

  get projectSelectionFilter(): (p: Project) => boolean {
    const {projectIds, isSingleProject} = this.props;
    const selectedProjects = new Set(projectIds.map(id => `${id}`));

    // If 'My Projects' or 'All Projects' are selected
    return selectedProjects.size === 0 || selectedProjects.has('-1') || isSingleProject
      ? _p => true
      : p => selectedProjects.has(p.id);
  }

  /**
   * Filter projects if there's a query
   */
  get filteredProjects() {
    const {projects, tableQuery} = this.props;
    return tableQuery
      ? projects.filter(
          p =>
            p.slug.includes(tableQuery) && p.hasAccess && this.projectSelectionFilter(p)
        )
      : projects.filter(p => p.hasAccess && this.projectSelectionFilter(p));
  }

  getTableHeader({showStoredOutcome}: {showStoredOutcome: boolean}) {
    const {key, direction} = this.tableSort;

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
        onClick: () => this.handleChangeSort(SortBy.PROJECT),
      },
      {
        key: SortBy.TOTAL,
        title: t('Total'),
        align: 'right',
        direction: getArrowDirection(SortBy.TOTAL),
        onClick: () => this.handleChangeSort(SortBy.TOTAL),
      },
      {
        key: SortBy.ACCEPTED,
        title: showStoredOutcome ? t('Accepted (Stored)') : t('Accepted'),
        align: 'right',
        direction: getArrowDirection(SortBy.ACCEPTED),
        onClick: () => this.handleChangeSort(SortBy.ACCEPTED),
      },
      {
        key: SortBy.FILTERED,
        title: t('Filtered'),
        align: 'right',
        direction: getArrowDirection(SortBy.FILTERED),
        onClick: () => this.handleChangeSort(SortBy.FILTERED),
      },
      {
        key: SortBy.RATE_LIMITED,
        title: t('Rate Limited'),
        align: 'right',
        direction: getArrowDirection(SortBy.RATE_LIMITED),
        onClick: () => this.handleChangeSort(SortBy.RATE_LIMITED),
      },
      {
        key: SortBy.INVALID,
        title: t('Invalid'),
        align: 'right',
        direction: getArrowDirection(SortBy.INVALID),
        onClick: () => this.handleChangeSort(SortBy.INVALID),
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
  }

  getProjectLink(project: Project) {
    const {dataCategory, getNextLocations, organization} = this.props;
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
  }

  handleChangeSort = (nextKey: SortBy) => {
    const {handleChangeState} = this.props;
    const {key, direction} = this.tableSort;

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
  };

  handleSearch = (query: string) => {
    const {handleChangeState, tableQuery} = this.props;

    if (query === tableQuery) {
      return;
    }

    if (!query) {
      handleChangeState({query: undefined, cursor: undefined});
      return;
    }

    handleChangeState({query, cursor: undefined});
  };

  mapSeriesToTable(projectStats?: UsageSeries): {
    hasStoredOutcome: boolean;
    tableStats: TableStat[];
    error?: Error;
  } {
    if (!projectStats) {
      return {tableStats: [], hasStoredOutcome: false};
    }

    const stats: Record<number, object> = {};

    try {
      const baseStat: Partial<TableStat> = {
        [SortBy.TOTAL]: 0,
        [SortBy.ACCEPTED]: 0,
        [SortBy.ACCEPTED_STORED]: 0,
        [SortBy.FILTERED]: 0,
        [SortBy.INVALID]: 0,
        [SortBy.RATE_LIMITED]: 0,
      };

      const projectList = this.filteredProjects;
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

        // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
        if (!stats[projectId!]) {
          // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
          stats[projectId!] = {...baseStat};
        }

        if (outcome !== Outcome.CLIENT_DISCARD && category !== 'span_indexed') {
          // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
          stats[projectId!]!.total += group.totals['sum(quantity)']!;
        }

        if (category === 'span_indexed' && outcome === Outcome.ACCEPTED) {
          // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
          stats[projectId!]!.accepted_stored += group.totals['sum(quantity)']!;
          return;
        }

        if (
          outcome === Outcome.ACCEPTED ||
          outcome === Outcome.FILTERED ||
          outcome === Outcome.INVALID
        ) {
          // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
          stats[projectId!]![outcome!] += group.totals['sum(quantity)']!;
        }

        if (
          outcome === Outcome.RATE_LIMITED ||
          outcome === Outcome.CARDINALITY_LIMITED ||
          outcome === Outcome.ABUSE
        ) {
          // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
          stats[projectId!]![SortBy.RATE_LIMITED] += group.totals['sum(quantity)']!;
        }
      });

      // For projects without stats, fill in with zero
      let hasStoredOutcome = false;
      const tableStats: TableStat[] = projectList.map(proj => {
        // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
        const stat = stats[proj.id] ?? {...baseStat};
        if (
          stat[SortBy.ACCEPTED_STORED] > 0 &&
          stat[SortBy.ACCEPTED_STORED] !== stat[SortBy.ACCEPTED]
        ) {
          hasStoredOutcome = true;
        }
        return {
          project: {...proj},
          ...this.getProjectLink(proj),
          ...stat,
        };
      });

      const {key, direction} = this.tableSort;
      tableStats.sort((a, b) => {
        if (key === SortBy.PROJECT) {
          return b.project.slug.localeCompare(a.project.slug) * direction;
        }

        return a[key] !== b[key]
          ? (b[key] - a[key]) * direction
          : a.project.slug.localeCompare(b.project.slug);
      });

      const offset = this.tableOffset;

      return {
        tableStats: tableStats.slice(
          offset,
          offset + UsageStatsProjects.MAX_ROWS_USAGE_TABLE
        ),
        hasStoredOutcome,
      };
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setContext('query', this.endpointQuery);
        scope.setContext('body', {...projectStats});
        Sentry.captureException(err);
      });

      return {
        tableStats: [],
        hasStoredOutcome: false,
        error: err,
      };
    }
  }

  renderComponent() {
    const {error, errors, loading} = this.state;
    const {dataCategory, loadingProjects, tableQuery, isSingleProject} = this.props;
    const {headers, tableStats, showStoredOutcome} = this.tableData;
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
              onSearch={this.handleSearch}
            />
          </Container>
        )}
        <Container data-test-id="usage-stats-table">
          <UsageTable
            isLoading={loading || loadingProjects}
            isError={error}
            errors={errors as any} // TODO(ts)
            isEmpty={tableStats.length === 0}
            headers={headers}
            dataCategory={dataCategory}
            usageStats={tableStats}
            showStoredOutcome={showStoredOutcome}
          />
          <Pagination pageLinks={this.pageLink} />
        </Container>
      </Fragment>
    );
  }
}

export default withProjects(UsageStatsProjects);

const Container = styled('div')`
  margin-bottom: ${space(2)};
`;

const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray400};
  display: flex;
  flex: 1;
  align-items: center;
`;

const PanelHeading = styled('div')`
  display: flex;
  margin-bottom: ${space(2)};
  align-items: center;
`;
