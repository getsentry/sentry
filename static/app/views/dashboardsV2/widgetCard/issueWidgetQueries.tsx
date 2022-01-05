import * as React from 'react';
import isEqual from 'lodash/isEqual';
import * as qs from 'query-string';

import {Client} from 'sentry/api';
import {SuggestedAssignee} from 'sentry/components/assigneeSelector';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {Actor, Group, OrganizationSummary, PageFilters, Team, User} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {IssueDisplayOptions, IssueSortOptions} from 'sentry/views/issueList/utils';

import {Widget, WidgetQuery} from '../types';

const MAX_ITEMS = 5;
const DEFAULT_SORT = IssueSortOptions.DATE;
const DEFAULT_DISPLAY = IssueDisplayOptions.EVENTS;
const DEFAULT_COLLAPSE = ['stats', 'filtered', 'lifetime'];
const DEFAULT_EXPAND = ['owners'];
import {buildTeamId} from 'sentry/utils';

type EndpointParams = Partial<PageFilters['datetime']> & {
  project: number[];
  environment: string[];
  query?: string;
  sort?: string;
  statsPeriod?: string;
  groupStatsPeriod?: string;
  cursor?: string;
  page?: number | string;
  display?: string;
  collapse?: string[];
  expand?: string[];
};

export type IssueTableData = {
  assignedTo: Actor;
  suggestedAssignees: SuggestedAssignee[];
};

type AssignableTeam = {
  id: string;
  display: string;
  email: string;
  team: Team;
};

type Props = {
  api: Client;
  organization: OrganizationSummary;
  widget: Widget;
  selection: PageFilters;
  children: (props: {
    loading: boolean;
    errorMessage: undefined | string;
    transformedResults: TableDataRow[];
    issueResults: IssueTableData[];
  }) => React.ReactNode;
  memberList: User[];
};

type State = {
  errorMessage: undefined | string;
  loading: boolean;
  tableResults: Group[];
};

class WidgetQueries extends React.Component<Props, State> {
  state: State = {
    loading: true,
    errorMessage: undefined,
    tableResults: [],
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const {selection, widget} = this.props;
    // We do not fetch data whenever the query name changes.
    const [prevWidgetQueries] = prevProps.widget.queries.reduce(
      ([queries, names]: [Omit<WidgetQuery, 'name'>[], string[]], {name, ...rest}) => {
        queries.push(rest);
        names.push(name);
        return [queries, names];
      },
      [[], []]
    );

    const [widgetQueries] = widget.queries.reduce(
      ([queries, names]: [Omit<WidgetQuery, 'name'>[], string[]], {name, ...rest}) => {
        queries.push(rest);
        names.push(name);
        return [queries, names];
      },
      [[], []]
    );

    if (
      !isEqual(widget.displayType, prevProps.widget.displayType) ||
      !isEqual(widget.interval, prevProps.widget.interval) ||
      !isEqual(widgetQueries, prevWidgetQueries) ||
      !isEqual(widget.displayType, prevProps.widget.displayType) ||
      !isSelectionEqual(selection, prevProps.selection)
    ) {
      this.fetchData();
      return;
    }
  }

  assignableTeams(group: Group): AssignableTeam[] {
    if (!group) {
      return [];
    }

    const teams = ProjectsStore.getBySlug(group.project.slug)?.teams ?? [];
    return teams
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(team => ({
        id: buildTeamId(team.id),
        display: `#${team.slug}`,
        email: team.id,
        team,
      }));
  }

  getSuggestedAssignees(group: Group): SuggestedAssignee[] {
    const {memberList} = this.props;
    const {owners: suggestedOwners} = group;
    if (!suggestedOwners) {
      return [];
    }

    const assignableTeams = this.assignableTeams(group);
    const suggestedAssignees: Array<SuggestedAssignee | null> = suggestedOwners.map(
      owner => {
        // converts a backend suggested owner to a suggested assignee
        const [ownerType, id] = owner.owner.split(':');
        if (ownerType === 'user') {
          const member = memberList.find(user => user.id === id);
          if (member) {
            return {
              type: 'user',
              id,
              name: member.name,
              suggestedReason: owner.type,
              assignee: member,
            };
          }
        } else if (ownerType === 'team') {
          const matchingTeam = assignableTeams.find(
            assignableTeam => assignableTeam.id === owner.owner
          );
          if (matchingTeam) {
            return {
              type: 'team',
              id,
              name: matchingTeam.team.name,
              suggestedReason: owner.type,
              assignee: matchingTeam,
            };
          }
        }

        return null;
      }
    );

    return suggestedAssignees.filter(owner => !!owner) as SuggestedAssignee[];
  }

  transformTableResults(tableResults: Group[]): {
    transformedTableResults: TableDataRow[];
    issueResults: IssueTableData[];
  } {
    const transformedTableResults: TableDataRow[] = [];
    const issueResults: IssueTableData[] = [];
    tableResults.forEach(group => {
      const {id, shortId, title, assignedTo, ...resultProps} = group;
      const transformedResultProps = {};
      Object.keys(resultProps).map(key => {
        const value = resultProps[key];
        transformedResultProps[key] = ['number', 'string'].includes(typeof value)
          ? value
          : String(value);
      });

      const transformedTableResult = {
        ...transformedResultProps,
        id,
        'issue.id': id,
        issue: shortId,
        title,
      };
      transformedTableResults.push(transformedTableResult);

      const suggestedAssignees = this.getSuggestedAssignees(group);
      const additionalTableResult = {
        id,
        assignedTo,
        suggestedAssignees,
      };
      issueResults.push(additionalTableResult);
    });
    return {transformedTableResults, issueResults};
  }

  fetchEventData() {
    const {selection, api, organization, widget} = this.props;
    this.setState({tableResults: []});
    // Issue Widgets only support single queries
    const query = widget.queries[0];
    const groupListUrl = `/organizations/${organization.slug}/issues/`;
    const params: EndpointParams = {
      project: selection.projects,
      environment: selection.environments,
      query: query.conditions,
      sort: query.orderby || DEFAULT_SORT,
      display: DEFAULT_DISPLAY,
      collapse: DEFAULT_COLLAPSE,
      expand: DEFAULT_EXPAND,
    };

    if (selection.datetime.period) {
      params.statsPeriod = selection.datetime.period;
    }
    if (selection.datetime.end) {
      params.end = getUtcDateString(selection.datetime.end);
    }
    if (selection.datetime.start) {
      params.start = getUtcDateString(selection.datetime.start);
    }
    if (selection.datetime.utc) {
      params.utc = selection.datetime.utc;
    }

    const groupListPromise = api.requestPromise(groupListUrl, {
      method: 'GET',
      data: qs.stringify({
        ...params,
        limit: MAX_ITEMS,
      }),
    });
    groupListPromise
      .then(data => {
        this.setState({loading: false, errorMessage: undefined, tableResults: data});
      })
      .catch(response => {
        const errorResponse = response?.responseJSON?.detail ?? null;
        this.setState({
          loading: false,
          errorMessage: errorResponse ?? t('Unable to load Widget'),
          tableResults: [],
        });
      });
  }

  fetchData() {
    this.setState({loading: true, errorMessage: undefined});
    this.fetchEventData();
  }

  render() {
    const {children} = this.props;
    const {loading, tableResults, errorMessage} = this.state;
    const {transformedTableResults: transformedResults, issueResults} =
      this.transformTableResults(tableResults);

    return children({loading, transformedResults, issueResults, errorMessage});
  }
}

export default WidgetQueries;
