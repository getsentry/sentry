import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {LocationDescriptorObject} from 'history';
import isEqual from 'lodash/isEqual';

import AsyncComponent from 'sentry/components/asyncComponent';
import {DateTimeObject, getSeriesApiInterval} from 'sentry/components/charts/utils';
import SortLink, {Alignments, Directions} from 'sentry/components/gridEditable/sortLink';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {DataCategory, Organization, Outcome, Project} from 'sentry/types';
import withProjects from 'sentry/utils/withProjects';

import {UsageSeries} from './types';
import UsageTable, {CellProject, CellStat, TableStat} from './usageTable';

type Props = {
  dataCategory: DataCategory;
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
  loadingProjects: boolean;
  organization: Organization;
  projectIds: number[];
  projects: Project[];
  tableCursor?: string;
  tableQuery?: string;
  tableSort?: string;
} & AsyncComponent['props'];

type State = {
  projectStats: UsageSeries | undefined;
} & AsyncComponent['state'];

export enum SortBy {
  PROJECT = 'project',
  TOTAL = 'total',
  ACCEPTED = 'accepted',
  FILTERED = 'filtered',
  DROPPED = 'dropped',
  INVALID = 'invalid',
  RATE_LIMITED = 'rate_limited',
}

class UsageStatsProjects extends AsyncComponent<Props, State> {
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

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    return [['projectStats', this.endpointPath, {query: this.endpointQuery}]];
  }

  get endpointPath() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/stats_v2/`;
  }

  get endpointQuery() {
    const {dataDatetime, dataCategory, projectIds} = this.props;

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

    // We do not need more granularity in the data so interval is '1d'
    return {
      ...queryDatetime,
      interval: getSeriesApiInterval(dataDatetime),
      groupBy: ['outcome', 'project'],
      field: ['sum(quantity)'],
      project: projectIds,
      category: dataCategory.slice(0, -1), // backend is singular
    };
  }

  get tableData() {
    const {projectStats} = this.state;

    return {
      headers: this.tableHeader,
      ...this.mapSeriesToTable(projectStats),
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
      case SortBy.DROPPED:
        return {key, direction};
      default:
        return {key: SortBy.ACCEPTED, direction: -1};
    }
  }

  get tableCursor() {
    const {tableCursor} = this.props;
    const offset = Number(tableCursor?.split(':')[1]);
    return isNaN(offset) ? 0 : offset;
  }

  /**
   * OrganizationStatsEndpointV2 does not have any performance issues. We use
   * client-side pagination to limit the number of rows on the table so the
   * page doesn't scroll too deeply for organizations with a lot of projects
   */
  get pageLink() {
    const numRows = this.filteredProjects.length;
    const offset = this.tableCursor;
    const prevOffset = offset - UsageStatsProjects.MAX_ROWS_USAGE_TABLE;
    const nextOffset = offset + UsageStatsProjects.MAX_ROWS_USAGE_TABLE;

    return `<link>; rel="previous"; results="${prevOffset >= 0}"; cursor="0:${Math.max(
      0,
      prevOffset
    )}:1", <link>; rel="next"; results="${
      nextOffset < numRows
    }"; cursor="0:${nextOffset}:0"`;
  }

  get projectSelectionFilter(): (p: Project) => boolean {
    const {projectIds} = this.props;
    const selectedProjects = new Set(projectIds.map(id => `${id}`));

    // If 'My Projects' or 'All Projects' are selected
    return selectedProjects.size === 0 || selectedProjects.has('-1')
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

  get tableHeader() {
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
        title: t('Accepted'),
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
        key: SortBy.DROPPED,
        title: t('Dropped'),
        align: 'right',
        direction: getArrowDirection(SortBy.DROPPED),
        onClick: () => this.handleChangeSort(SortBy.DROPPED),
      },
    ].map(h => {
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
    });
  }

  getProjectLink(project: Project) {
    const {dataCategory, getNextLocations, organization} = this.props;
    const {performance, projectDetail, settings} = getNextLocations(project);

    if (
      dataCategory === DataCategory.TRANSACTIONS &&
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
    tableStats: TableStat[];
    error?: Error;
  } {
    if (!projectStats) {
      return {tableStats: []};
    }

    const stats: Record<number, object> = {};

    try {
      const baseStat: Partial<TableStat> = {
        [SortBy.TOTAL]: 0,
        [SortBy.ACCEPTED]: 0,
        [SortBy.FILTERED]: 0,
        [SortBy.DROPPED]: 0,
      };

      const projectList = this.filteredProjects;
      const projectSet = new Set(projectList.map(p => p.id));

      projectStats.groups.forEach(group => {
        const {outcome, project: projectId} = group.by;
        // Backend enum is singlar. Frontend enum is plural.

        if (!projectSet.has(projectId.toString())) {
          return;
        }

        if (!stats[projectId]) {
          stats[projectId] = {...baseStat};
        }

        if (outcome !== Outcome.CLIENT_DISCARD) {
          stats[projectId].total += group.totals['sum(quantity)'];
        }

        if (outcome === Outcome.ACCEPTED || outcome === Outcome.FILTERED) {
          stats[projectId][outcome] += group.totals['sum(quantity)'];
        } else if (
          outcome === Outcome.RATE_LIMITED ||
          outcome === Outcome.INVALID ||
          outcome === Outcome.DROPPED
        ) {
          stats[projectId][SortBy.DROPPED] += group.totals['sum(quantity)'];
        }
      });

      // For projects without stats, fill in with zero
      const tableStats: TableStat[] = projectList.map(proj => {
        const stat = stats[proj.id] ?? {...baseStat};
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

      const offset = this.tableCursor;

      return {
        tableStats: tableStats.slice(
          offset,
          offset + UsageStatsProjects.MAX_ROWS_USAGE_TABLE
        ),
      };
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setContext('query', this.endpointQuery);
        scope.setContext('body', {...projectStats});
        Sentry.captureException(err);
      });

      return {
        tableStats: [],
        error: err,
      };
    }
  }

  renderComponent() {
    const {error, errors, loading} = this.state;
    const {dataCategory, loadingProjects, tableQuery} = this.props;
    const {headers, tableStats} = this.tableData;

    return (
      <Fragment>
        <Container>
          <SearchBar
            defaultQuery=""
            query={tableQuery}
            placeholder={t('Filter your projects')}
            onSearch={this.handleSearch}
          />
        </Container>
        <Container data-test-id="usage-stats-table">
          <UsageTable
            isLoading={loading || loadingProjects}
            isError={error}
            errors={errors as any} // TODO(ts)
            isEmpty={tableStats.length === 0}
            headers={headers}
            dataCategory={dataCategory}
            usageStats={tableStats}
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
