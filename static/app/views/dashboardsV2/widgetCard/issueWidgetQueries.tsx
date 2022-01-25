import * as React from 'react';
import isEqual from 'lodash/isEqual';
import * as qs from 'query-string';

import {Client} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import {Group, OrganizationSummary, PageFilters} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {queryToObj} from 'sentry/utils/stream';
import {
  DISCOVER_EXCLUSION_FIELDS,
  IssueDisplayOptions,
  IssueSortOptions,
} from 'sentry/views/issueList/utils';

import {Widget, WidgetQuery} from '../types';

const DEFAULT_ITEM_LIMIT = 5;
const DEFAULT_SORT = IssueSortOptions.DATE;
const DEFAULT_DISPLAY = IssueDisplayOptions.EVENTS;
const DEFAULT_EXPAND = ['owners'];

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

type Props = {
  api: Client;
  organization: OrganizationSummary;
  widget: Widget;
  selection: PageFilters;
  limit?: number;
  children: (props: {
    loading: boolean;
    errorMessage: undefined | string;
    transformedResults: TableDataRow[];
  }) => React.ReactNode;
};

type State = {
  errorMessage: undefined | string;
  loading: boolean;
  tableResults: Group[];
  memberListStoreLoaded: boolean;
  totalCount: null | string;
};

class IssueWidgetQueries extends React.Component<Props, State> {
  state: State = {
    loading: true,
    errorMessage: undefined,
    tableResults: [],
    memberListStoreLoaded: MemberListStore.isLoaded(),
    totalCount: null,
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

  componentWillUnmount() {
    this.unlisteners.forEach(unlistener => unlistener?.());
  }

  unlisteners = [
    MemberListStore.listen(() => {
      this.setState({
        memberListStoreLoaded: MemberListStore.isLoaded(),
      });
    }, undefined),
  ];

  transformTableResults(): TableDataRow[] {
    const {selection, widget} = this.props;
    const {tableResults} = this.state;
    GroupStore.add(tableResults);
    const transformedTableResults: TableDataRow[] = [];
    tableResults.forEach(group => {
      const {id, shortId, title, lifetime, filtered, ...resultProps} = group;
      const transformedResultProps: Omit<TableDataRow, 'id'> = {};
      Object.keys(resultProps)
        .filter(key => ['number', 'string'].includes(typeof resultProps[key]))
        .forEach(key => {
          transformedResultProps[key] = resultProps[key];
        });

      const transformedTableResult: TableDataRow = {
        ...transformedResultProps,
        id,
        'issue.id': id,
        issue: shortId,
        title,
      };

      // Get lifetime stats
      if (lifetime) {
        transformedTableResult.lifetimeCount = lifetime?.count;
        transformedTableResult.lifetimeUserCount = lifetime?.userCount;
      }
      // Get filtered stats
      if (filtered) {
        transformedTableResult.filteredCount = filtered?.count;
        transformedTableResult.filteredUserCount = filtered?.userCount;
      }

      // Discover Url properties
      const query = widget.queries[0].conditions;
      const queryTerms: string[] = [];
      if (typeof query === 'string') {
        const queryObj = queryToObj(query);
        for (const queryTag in queryObj) {
          if (!DISCOVER_EXCLUSION_FIELDS.includes(queryTag)) {
            const queryVal = queryObj[queryTag].includes(' ')
              ? `"${queryObj[queryTag]}"`
              : queryObj[queryTag];
            queryTerms.push(`${queryTag}:${queryVal}`);
          }
        }

        if (queryObj.__text) {
          queryTerms.push(queryObj.__text);
        }
      }
      transformedTableResult.discoverSearchQuery =
        (queryTerms.length ? ' ' : '') + queryTerms.join(' ');
      transformedTableResult.projectId = group.project.id;

      const {period, start, end} = selection.datetime || {};
      if (start && end) {
        transformedTableResult.start = getUtcDateString(start);
        transformedTableResult.end = getUtcDateString(end);
      }
      transformedTableResult.period = period;
      transformedTableResults.push(transformedTableResult);
    });
    return transformedTableResults;
  }

  async fetchIssuesData() {
    const {selection, api, organization, widget, limit} = this.props;
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

    try {
      const [data, _, resp] = await api.requestPromise(groupListUrl, {
        includeAllArgs: true,
        method: 'GET',
        data: qs.stringify({
          ...params,
          limit: limit ?? DEFAULT_ITEM_LIMIT,
        }),
      });
      this.setState({
        loading: false,
        errorMessage: undefined,
        tableResults: data,
        totalCount: resp?.getResponseHeader('X-Hits') ?? null,
      });
    } catch (response) {
      const errorResponse = response?.responseJSON?.detail ?? null;
      this.setState({
        loading: false,
        errorMessage: errorResponse ?? t('Unable to load Widget'),
        tableResults: [],
      });
    }
  }

  fetchData() {
    this.setState({loading: true, errorMessage: undefined});
    this.fetchIssuesData();
  }

  render() {
    const {children} = this.props;
    const {loading, errorMessage, memberListStoreLoaded} = this.state;
    const transformedResults = this.transformTableResults();
    return children({
      loading: loading || !memberListStoreLoaded,
      transformedResults,
      errorMessage,
    });
  }
}

export default IssueWidgetQueries;
