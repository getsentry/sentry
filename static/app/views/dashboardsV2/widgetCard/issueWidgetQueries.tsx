import {Component} from 'react';
import isEqual from 'lodash/isEqual';

import {Client} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import {OrganizationSummary, PageFilters} from 'sentry/types';
import {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import getDynamicText from 'sentry/utils/getDynamicText';

import {getDatasetConfig} from '../datasetConfig/base';
import {Widget, WidgetQuery, WidgetType} from '../types';

type Props = {
  api: Client;
  children: (props: {
    errorMessage: undefined | string;
    loading: boolean;
    transformedResults: TableDataRow[];
    pageLinks?: null | string;
    totalCount?: string;
  }) => React.ReactNode;
  organization: OrganizationSummary;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  limit?: number;
  onDataFetched?: (results: {
    issuesResults?: TableDataRow[];
    pageLinks?: string;
    totalIssuesCount?: string;
  }) => void;
};

type State = {
  errorMessage: undefined | string;
  loading: boolean;
  memberListStoreLoaded: boolean;
  tableResults: TableDataRow[];
  totalCount: null | string;
  pageLinks?: null | string;
};

class IssueWidgetQueries extends Component<Props, State> {
  state: State = {
    loading: true,
    errorMessage: undefined,
    tableResults: [],
    memberListStoreLoaded: MemberListStore.isLoaded(),
    totalCount: null,
    pageLinks: null,
  };

  componentDidMount() {
    this.fetchData();
    this._isMounted = true;
  }

  componentDidUpdate(prevProps: Props) {
    const {selection, widget, cursor} = this.props;
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
      !isSelectionEqual(selection, prevProps.selection) ||
      cursor !== prevProps.cursor
    ) {
      this.fetchData();
      return;
    }
  }

  componentWillUnmount() {
    this.unlisteners.forEach(unlistener => unlistener?.());
    this._isMounted = false;
  }

  private _isMounted: boolean = false;

  unlisteners = [
    MemberListStore.listen(() => {
      this.setState({
        memberListStoreLoaded: MemberListStore.isLoaded(),
      });
    }, undefined),
  ];

  config = getDatasetConfig(WidgetType.ISSUE);

  processTableResponse = responses => {
    const {widget} = this.props;
    let transformedResults: TableData = {data: []};
    let pageLinks: null | string = null;
    let totalCount: null | string = null;
    responses.forEach(response => {
      const [data, _textstatus, resp] = response;

      transformedResults = this.config.transformTable(data, widget.queries[0]);

      pageLinks = resp?.getResponseHeader('Link') ?? null;
      totalCount = resp?.getResponseHeader('X-Hits') ?? null;
    });
    return {
      pageLinks: pageLinks ?? undefined,
      totalCount,
      tableResults: transformedResults.data,
    };
  };

  async fetchData() {
    const {api, selection, widget, limit, cursor, organization, onDataFetched} =
      this.props;

    const requests = this.config.getTableRequests!(
      widget,
      {
        organization,
        pageFilters: selection,
        api,
      },
      limit,
      cursor
    );

    try {
      this.setState({tableResults: [], loading: true, errorMessage: undefined});

      const responses = await Promise.all(requests);
      const {totalCount, pageLinks, tableResults} = this.processTableResponse(responses);

      if (!this._isMounted) {
        return;
      }
      onDataFetched?.({
        issuesResults: tableResults,
        totalIssuesCount: totalCount ?? undefined,
        pageLinks: pageLinks ?? undefined,
      });
      this.setState({
        loading: false,
        tableResults,
        totalCount,
        pageLinks,
      });
    } catch (response) {
      const errorResponse = response?.responseJSON?.detail ?? null;
      if (!this._isMounted) {
        return;
      }
      this.setState({
        loading: false,
        errorMessage: errorResponse ?? t('Unable to load Widget'),
        tableResults: [],
      });
    }
  }

  render() {
    const {children} = this.props;
    const {
      tableResults,
      loading,
      errorMessage,
      memberListStoreLoaded,
      pageLinks,
      totalCount,
    } = this.state;
    return getDynamicText({
      value: children({
        loading: loading || !memberListStoreLoaded,
        transformedResults: tableResults,
        errorMessage,
        pageLinks,
        totalCount: totalCount ?? undefined,
      }),
      fixed: <div />,
    });
  }
}

export default IssueWidgetQueries;
