import {Component} from 'react';
import isEqual from 'lodash/isEqual';

import {Client} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import {OrganizationSummary, PageFilters} from 'sentry/types';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import getDynamicText from 'sentry/utils/getDynamicText';

import {getDatasetConfig} from '../datasetConfig/base';
import {Widget, WidgetQuery, WidgetType} from '../types';

export type EndpointParams = Partial<PageFilters['datetime']> & {
  environment: string[];
  project: number[];
  collapse?: string[];
  cursor?: string;
  expand?: string[];
  groupStatsPeriod?: string | null;
  limit?: number;
  page?: number | string;
  query?: string;
  sort?: string;
  statsPeriod?: string | null;
};

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
  pageLinks: null | string;
  tableResults: TableDataRow[];
  totalCount: null | string;
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
  }

  unlisteners = [
    MemberListStore.listen(() => {
      this.setState({
        memberListStoreLoaded: MemberListStore.isLoaded(),
      });
    }, undefined),
  ];

  config = getDatasetConfig(WidgetType.ISSUE);

  async fetchTableData() {
    const {selection, api, organization, widget, limit, cursor, onDataFetched} =
      this.props;
    this.setState({tableResults: []});

    const groupListUrl = `/organizations/${organization.slug}/issues/`;
    const params = this.config.getTableRequestParams!(widget, limit, cursor, {
      pageFilters: selection,
    });
    try {
      const [data, _, resp] = await api.requestPromise(groupListUrl, {
        includeAllArgs: true,
        method: 'GET',
        data: {
          ...params,
        },
      });
      const tableResults = this.config.transformTable(data, widget.queries[0], {
        pageFilters: selection,
      });
      const totalCount = resp?.getResponseHeader('X-Hits') ?? null;
      const pageLinks = resp?.getResponseHeader('Link') ?? null;
      this.setState({
        loading: false,
        errorMessage: undefined,
        tableResults: tableResults.data,
        totalCount,
        pageLinks,
      });
      onDataFetched?.({
        issuesResults: tableResults.data,
        totalIssuesCount: totalCount ?? undefined,
        pageLinks: pageLinks ?? undefined,
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
    this.fetchTableData();
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
