import {Component} from 'react';
import {browserHistory, WithRouterProps} from 'react-router';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import {Client} from 'sentry/api';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import IssuesReplayCountProvider from 'sentry/components/replays/issuesReplayCountProvider';
import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {treeResultLocator} from 'sentry/components/searchSyntax/utils';
import StreamGroup, {
  DEFAULT_STREAM_GROUP_STATS_PERIOD,
} from 'sentry/components/stream/group';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {Group} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';
import {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {RELATED_ISSUES_BOOLEAN_QUERY_ERROR} from 'sentry/views/alerts/rules/metric/details/relatedIssuesNotAvailable';

import GroupListHeader from './groupListHeader';

const defaultProps = {
  canSelectGroups: true,
  withChart: true,
  withPagination: true,
  useFilteredStats: true,
  useTintRow: true,
  narrowGroups: false,
};

type Props = WithRouterProps & {
  api: Client;
  endpointPath: string;
  orgId: string;
  query: string;
  customStatsPeriod?: TimePeriodType;
  onFetchSuccess?: (
    groupListState: State,
    onCursor: (
      cursor: string,
      path: string,
      query: Record<string, any>,
      pageDiff: number
    ) => void
  ) => void;
  queryFilterDescription?: string;
  queryParams?: Record<string, number | string | string[] | undefined | null>;
  renderEmptyMessage?: () => React.ReactNode;
  renderErrorMessage?: (props: {detail: string}, retry: () => void) => React.ReactNode;
  // where the group list is rendered
  source?: string;
} & Partial<typeof defaultProps>;

type State = {
  error: boolean;
  errorData: {detail: string} | null;
  groups: Group[];
  loading: boolean;
  pageLinks: string | null;
  memberList?: ReturnType<typeof indexMembersByProject>;
};

class GroupList extends Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = {
    loading: true,
    error: false,
    errorData: null,
    groups: [],
    pageLinks: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    return (
      !isEqual(this.state, nextState) ||
      nextProps.endpointPath !== this.props.endpointPath ||
      nextProps.query !== this.props.query ||
      !isEqual(nextProps.queryParams, this.props.queryParams)
    );
  }

  componentDidUpdate(prevProps: Props) {
    const ignoredQueryParams = ['end'];

    if (
      prevProps.orgId !== this.props.orgId ||
      prevProps.endpointPath !== this.props.endpointPath ||
      prevProps.query !== this.props.query ||
      !isEqual(
        omit(prevProps.queryParams, ignoredQueryParams),
        omit(this.props.queryParams, ignoredQueryParams)
      )
    ) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    GroupStore.reset();
    this.listener?.();
  }

  listener = GroupStore.listen(() => this.onGroupChange(), undefined);

  fetchData = async () => {
    GroupStore.loadInitialData([]);
    const {api, orgId, queryParams} = this.props;
    api.clear();

    this.setState({loading: true, error: false, errorData: null});

    fetchOrgMembers(api, orgId).then(members => {
      this.setState({memberList: indexMembersByProject(members)});
    });

    const endpoint = this.getGroupListEndpoint();

    const parsedQuery = parseSearch((queryParams ?? this.getQueryParams()).query);
    const hasLogicBoolean = parsedQuery
      ? treeResultLocator<boolean>({
          tree: parsedQuery,
          noResultValue: false,
          visitorTest: ({token, returnResult}) => {
            return token.type === Token.LogicBoolean ? returnResult(true) : null;
          },
        })
      : false;

    // Check if the alert rule query has AND or OR
    // logic queries haven't been implemented for issue search yet
    if (hasLogicBoolean) {
      this.setState({
        error: true,
        errorData: {detail: RELATED_ISSUES_BOOLEAN_QUERY_ERROR},
        loading: false,
      });
      return;
    }

    try {
      const [data, , jqXHR] = await api.requestPromise(endpoint, {
        includeAllArgs: true,
      });

      GroupStore.add(data);

      this.setState(
        {
          error: false,
          errorData: null,
          loading: false,
          pageLinks: jqXHR?.getResponseHeader('Link') ?? null,
        },
        () => {
          this.props.onFetchSuccess?.(this.state, this.handleCursorChange);
        }
      );
    } catch (error) {
      this.setState({error: true, errorData: error.responseJSON, loading: false});
    }
  };

  getGroupListEndpoint() {
    const {orgId, endpointPath, queryParams} = this.props;
    const path = endpointPath ?? `/organizations/${orgId}/issues/`;
    const queryParameters = queryParams ?? this.getQueryParams();

    return `${path}?${qs.stringify(queryParameters)}`;
  }

  getQueryParams() {
    const {location, query} = this.props;

    const queryParams = location.query;
    queryParams.limit = 50;
    queryParams.sort = 'new';
    queryParams.query = query;

    return queryParams;
  }

  handleCursorChange(
    cursor: string | undefined,
    path: string,
    query: Record<string, any>,
    pageDiff: number
  ) {
    const queryPageInt = parseInt(query.page, 10);
    let nextPage: number | undefined = isNaN(queryPageInt)
      ? pageDiff
      : queryPageInt + pageDiff;

    // unset cursor and page when we navigate back to the first page
    // also reset cursor if somehow the previous button is enabled on
    // first page and user attempts to go backwards
    if (nextPage <= 0) {
      cursor = undefined;
      nextPage = undefined;
    }

    browserHistory.push({
      pathname: path,
      query: {...query, cursor, page: nextPage},
    });
  }

  onGroupChange() {
    const groups = GroupStore.getAllItems() as Group[];
    if (!isEqual(groups, this.state.groups)) {
      this.setState({groups});
    }
  }

  render() {
    const {
      canSelectGroups,
      withChart,
      renderEmptyMessage,
      renderErrorMessage,
      withPagination,
      useFilteredStats,
      useTintRow,
      customStatsPeriod,
      queryParams,
      queryFilterDescription,
      narrowGroups,
      source,
    } = this.props;
    const {loading, error, errorData, groups, memberList, pageLinks} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (error) {
      if (typeof renderErrorMessage === 'function' && errorData) {
        return renderErrorMessage(errorData, this.fetchData);
      }

      return <LoadingError onRetry={this.fetchData} />;
    }

    if (groups.length === 0) {
      if (typeof renderEmptyMessage === 'function') {
        return renderEmptyMessage();
      }
      return (
        <Panel>
          <PanelBody>
            <EmptyStateWarning>
              <p>{t("There don't seem to be any events fitting the query.")}</p>
            </EmptyStateWarning>
          </PanelBody>
        </Panel>
      );
    }

    const statsPeriod =
      queryParams?.groupStatsPeriod === 'auto'
        ? queryParams?.groupStatsPeriod
        : DEFAULT_STREAM_GROUP_STATS_PERIOD;

    return (
      <IssuesReplayCountProvider groupIds={groups.map(({id}) => id)}>
        <Panel>
          <GroupListHeader withChart={!!withChart} narrowGroups={narrowGroups} />
          <PanelBody>
            {groups.map(({id, project}) => {
              const members = memberList?.hasOwnProperty(project.slug)
                ? memberList[project.slug]
                : undefined;

              return (
                <StreamGroup
                  key={id}
                  id={id}
                  canSelect={canSelectGroups}
                  withChart={withChart}
                  memberList={members}
                  useFilteredStats={useFilteredStats}
                  useTintRow={useTintRow}
                  customStatsPeriod={customStatsPeriod}
                  statsPeriod={statsPeriod}
                  queryFilterDescription={queryFilterDescription}
                  narrowGroups={narrowGroups}
                  source={source}
                />
              );
            })}
          </PanelBody>
        </Panel>
        {withPagination && (
          <Pagination pageLinks={pageLinks} onCursor={this.handleCursorChange} />
        )}
      </IssuesReplayCountProvider>
    );
  }
}

export {GroupList};

export default withApi(withSentryRouter(GroupList));
