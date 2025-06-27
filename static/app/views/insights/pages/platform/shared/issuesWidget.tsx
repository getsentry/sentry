import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import * as qs from 'query-string';

import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import type {Client} from 'sentry/api';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupListHeader from 'sentry/components/issues/groupListHeader';
import IssueStreamHeaderLabel from 'sentry/components/IssueStreamHeaderLabel';
import LoadingError from 'sentry/components/loadingError';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {treeResultLocator} from 'sentry/components/searchSyntax/utils';
import StreamGroup, {
  DEFAULT_STREAM_GROUP_STATS_PERIOD,
} from 'sentry/components/stream/group';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {t, tct} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useBreakpoints} from 'sentry/utils/useBreakpoints';
import {useLocation} from 'sentry/utils/useLocation';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import {RELATED_ISSUES_BOOLEAN_QUERY_ERROR} from 'sentry/views/alerts/rules/metric/details/relatedIssuesNotAvailable';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

const defaultProps = {
  canSelectGroups: true,
  withChart: true,
  useFilteredStats: true,
  useTintRow: true,
};

type GroupListColumn =
  | 'graph'
  | 'event'
  | 'users'
  | 'priority'
  | 'assignee'
  | 'lastTriggered'
  | 'firstSeen'
  | 'lastSeen';

type Props = {
  api: Client;
  organization: Organization;
  queryParams: Record<string, number | string | string[] | undefined | null>;
  renderEmptyMessage?: () => React.ReactNode;
  // where the group list is rendered
  source?: string;
} & Partial<typeof defaultProps>;

type State = {
  error: boolean;
  errorData: {detail: string} | null;
  groups: Group[];
  loading: boolean;
  memberList?: ReturnType<typeof indexMembersByProject>;
};

class IssuesGroupList extends Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = {
    loading: true,
    error: false,
    errorData: null,
    groups: [],
  };

  componentDidMount() {
    this.fetchData();
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    return (
      !isEqual(this.state, nextState) ||
      !isEqual(nextProps.queryParams, this.props.queryParams)
    );
  }

  componentDidUpdate(prevProps: Props) {
    const ignoredQueryParams = ['end'];

    if (
      prevProps.organization.slug !== this.props.organization.slug ||
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
    const {api, organization, queryParams} = this.props;
    api.clear();

    this.setState({loading: true, error: false, errorData: null});

    fetchOrgMembers(api, organization.slug).then(members => {
      this.setState({memberList: indexMembersByProject(members)});
    });

    const endpoint = this.getGroupListEndpoint();

    const parsedQuery = parseSearch(queryParams.query as string);
    const hasLogicBoolean = parsedQuery
      ? treeResultLocator<boolean>({
          tree: parsedQuery,
          noResultValue: false,
          visitorTest: ({token, returnResult}) => {
            return token.type === Token.LOGIC_BOOLEAN ? returnResult(true) : null;
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
      const [data] = await api.requestPromise(endpoint, {
        includeAllArgs: true,
      });

      GroupStore.add(data);

      this.setState({
        error: false,
        errorData: null,
        loading: false,
      });
    } catch (error) {
      this.setState({error: true, errorData: error.responseJSON, loading: false});
    }
  };

  getGroupListEndpoint() {
    const {organization, queryParams} = this.props;
    const path = `/organizations/${organization.slug}/issues/`;

    return `${path}?${qs.stringify(queryParams)}`;
  }

  onGroupChange() {
    const groups = GroupStore.getAllItems() as Group[];
    if (!isEqual(groups, this.state.groups)) {
      this.setState({groups});
    }
  }

  getIssuesUrl(queryParams: Record<string, any> = {}) {
    const {organization} = this.props;
    const query = new MutableSearch([]);

    return {
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {
        ...queryParams,
        limit: undefined,
        cursor: undefined,
        query: query.formatString(),
      },
    };
  }

  render() {
    const {
      canSelectGroups,
      withChart,
      renderEmptyMessage,
      useFilteredStats,
      useTintRow,
      queryParams,
      source,
    } = this.props;
    const {loading, error, groups, memberList} = this.state;

    const columns: GroupListColumn[] = [
      'graph',
      'event',
      'users',
      'assignee',
      'firstSeen' as const,
      'lastSeen' as const,
    ];

    if (error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    if (!loading && groups.length === 0) {
      if (typeof renderEmptyMessage === 'function') {
        return renderEmptyMessage();
      }
      return (
        <StyledPanel>
          <PanelBody>
            <EmptyStateWarning>
              <p>{t("There don't seem to be any events fitting the query.")}</p>
            </EmptyStateWarning>
          </PanelBody>
        </StyledPanel>
      );
    }

    const statsPeriod =
      queryParams?.groupStatsPeriod === 'auto'
        ? queryParams?.groupStatsPeriod
        : DEFAULT_STREAM_GROUP_STATS_PERIOD;

    return (
      <Fragment>
        <StyledPanel>
          <HeaderContainer>
            <SuperHeader disablePadding>
              <SuperHeaderLabel hideDivider>{t('Recommended Issues')}</SuperHeaderLabel>
              <LinkButton to={this.getIssuesUrl(queryParams)} size="xs">
                {t('View All')}
              </LinkButton>
            </SuperHeader>
            <GroupListHeader withChart={!!withChart} withColumns={columns} />
          </HeaderContainer>
          <PanelBody>
            {loading
              ? [
                  ...new Array(
                    typeof queryParams?.limit === 'number' ? queryParams?.limit : 4
                  ),
                ].map((_, i) => (
                  <GroupPlaceholder key={i}>
                    <Placeholder height="50px" />
                  </GroupPlaceholder>
                ))
              : groups.map(({id, project}) => {
                  const members = memberList?.hasOwnProperty(project.slug)
                    ? memberList[project.slug]
                    : undefined;

                  return (
                    <StreamGroup
                      key={id}
                      id={id}
                      canSelect={canSelectGroups}
                      withChart={withChart}
                      withColumns={columns}
                      memberList={members}
                      useFilteredStats={useFilteredStats}
                      useTintRow={useTintRow}
                      statsPeriod={statsPeriod}
                      source={source}
                    />
                  );
                })}
          </PanelBody>
        </StyledPanel>
      </Fragment>
    );
  }
}

const IssuesGroupListWithOrganization = withOrganization(withApi(IssuesGroupList));

const GroupPlaceholder = styled('div')`
  padding: ${space(1)};

  &:not(:last-child) {
    border-bottom: solid 1px ${p => p.theme.innerBorder};
  }
`;

const SuperHeaderLabel = styled(IssueStreamHeaderLabel)`
  color: ${p => p.theme.headingColor};
  font-size: 1rem;
  line-height: 1.2;
  padding-left: ${space(1)};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const SuperHeader = styled(PanelHeader)`
  background-color: ${p => p.theme.headerBackground};
  padding: ${space(1)};
  text-transform: capitalize;
`;

const HeaderContainer = styled('div')`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.header};
`;

export function IssuesWidget() {
  const location = useLocation();
  const {query} = useTransactionNameQuery();

  const queryParams = {
    limit: '5',
    ...normalizeDateTimeParams(
      pick(location.query, [...Object.values(URL_PARAM), 'cursor'])
    ),
    query: `is:unresolved event.type:error ${query}`,
    sort: 'freq',
  };

  const breakpoints = useBreakpoints();

  function renderEmptyMessage() {
    const selectedTimePeriod = location.query.start
      ? null
      : DEFAULT_RELATIVE_PERIODS[
          decodeScalar(
            location.query.statsPeriod,
            DEFAULT_STATS_PERIOD
          ) as keyof typeof DEFAULT_RELATIVE_PERIODS
        ];
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <StyledPanel
        style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}
      >
        <PanelBody>
          <EmptyStateWarning>
            <p>
              {tct('No [issuesType] issues for the [timePeriod].', {
                issuesType: '',
                timePeriod: displayedPeriod,
              })}
            </p>
          </EmptyStateWarning>
        </PanelBody>
      </StyledPanel>
    );
  }

  // TODO(aknaus): Remove GroupList and use StreamGroup directly
  return (
    <IssuesGroupListWithOrganization
      queryParams={queryParams}
      canSelectGroups={false}
      renderEmptyMessage={renderEmptyMessage}
      withChart={breakpoints.xl}
      useFilteredStats={false}
      source="laravel-insights"
    />
  );
}

const StyledPanel = styled(Panel)`
  min-width: 0;
  overflow-y: auto;
  margin-bottom: 0 !important;
  height: 100%;
  container-type: inline-size;
`;
