import * as React from 'react';
import isEqual from 'lodash/isEqual';
import * as qs from 'query-string';

import {Client} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import {Group, OrganizationSummary, PageFilters} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {IssueDisplayOptions, IssueSortOptions} from 'sentry/views/issueList/utils';

import {Widget, WidgetQuery} from '../types';

const MAX_ITEMS = 5;
const DEFAULT_SORT = IssueSortOptions.DATE;
const DEFAULT_DISPLAY = IssueDisplayOptions.EVENTS;
const DEFAULT_COLLAPSE = ['stats', 'filtered', 'lifetime'];

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
};

interface Props {
  api: Client;
  organization: OrganizationSummary;
  widget: Widget;
  selection: PageFilters;
  children: (props: {
    loading: boolean;
    errorMessage: undefined | string;
    transformedResults: TableDataRow[];
  }) => React.ReactNode;
}

interface State {
  errorMessage: undefined | string;
  loading: boolean;
  tableResults: Group[];
}

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

  transformTableResults(tableResults: Group[]): TableDataRow[] {
    return tableResults.map(({id, shortId, title, assignedTo, ...resultProps}) => {
      const transformedResultProps = {};
      Object.keys(resultProps).map(key => {
        const value = resultProps[key];
        transformedResultProps[key] = ['number', 'string'].includes(typeof value)
          ? value
          : String(value);
      });
      const transformedTableResults = {
        ...transformedResultProps,
        id,
        'issue.id': id,
        issue: shortId,
        title,
        'assignee.type': assignedTo?.type,
        'assignee.name': assignedTo?.name ?? '',
        'assignee.id': assignedTo?.id,
        'assignee.email': assignedTo?.email ?? '',
      };
      return transformedTableResults;
    });
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
    const transformedResults = this.transformTableResults(tableResults);

    return children({loading, transformedResults, errorMessage});
  }
}

export default WidgetQueries;
