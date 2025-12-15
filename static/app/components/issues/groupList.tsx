import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {treeResultLocator} from 'sentry/components/searchSyntax/utils';
import StreamGroup, {
  DEFAULT_STREAM_GROUP_STATS_PERIOD,
} from 'sentry/components/stream/group';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {RELATED_ISSUES_BOOLEAN_QUERY_ERROR} from 'sentry/views/alerts/rules/metric/details/relatedIssuesNotAvailable';

import GroupListHeader from './groupListHeader';

export type GroupListColumn =
  | 'graph'
  | 'event'
  | 'users'
  | 'priority'
  | 'assignee'
  | 'lastTriggered'
  | 'firstSeen'
  | 'lastSeen';

type Props = {
  /**
   * Number of placeholder rows to show during loading
   */
  numPlaceholderRows: number;
  queryParams: Record<string, number | string | string[] | undefined | null>;
  canSelectGroups?: boolean;
  customStatsPeriod?: TimePeriodType;
  /**
   * Defaults to `/organizations/${orgSlug}/issues/`
   */
  endpointPath?: string;
  onFetchSuccess?: (
    groupListState: State,
    onCursor: (
      cursor: string,
      path: string,
      query: Record<string, any>,
      pageDiff: number
    ) => void
  ) => void;
  /**
   * Use `query` within `queryParams` for passing the parameter to the endpoint
   */
  query?: string;
  queryFilterDescription?: string;
  renderEmptyMessage?: () => React.ReactNode;
  renderErrorMessage?: (props: {detail: string}, retry: () => void) => React.ReactNode;
  // where the group list is rendered
  source?: string;
  useFilteredStats?: boolean;
  useTintRow?: boolean;
  withChart?: boolean;
  withColumns?: GroupListColumn[];
  withPagination?: boolean;
};

type State = {
  error: boolean;
  errorData: {detail: string} | null;
  groups: Group[];
  loading: boolean;
  pageLinks: string | null;
  memberList?: ReturnType<typeof indexMembersByProject>;
};

const DEFAULT_COLUMNS: GroupListColumn[] = ['graph', 'event', 'users', 'assignee'];

function GroupList({
  queryParams,
  endpointPath,
  onFetchSuccess,
  renderEmptyMessage,
  renderErrorMessage,
  customStatsPeriod,
  queryFilterDescription,
  source,
  query,
  numPlaceholderRows,
  withColumns = DEFAULT_COLUMNS,
  withChart = true,
  withPagination = true,
  canSelectGroups = true,
  useFilteredStats = true,
  useTintRow = true,
}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const [memberList, setMemberList] = useState<
    ReturnType<typeof indexMembersByProject> | undefined
  >(undefined);

  const getQueryParams = useCallback(() => {
    const queryParamsFromLocation = {...location.query};
    queryParamsFromLocation.limit = '50';
    queryParamsFromLocation.sort = 'new';
    queryParamsFromLocation.query = query;

    return queryParamsFromLocation;
  }, [location.query, query]);

  const computedQueryParams = useMemo(
    () => queryParams ?? getQueryParams(),
    [getQueryParams, queryParams]
  );

  const handleCursorChange = useCallback(
    (
      cursor: string | undefined,
      path: string,
      queryParam: Record<string, any>,
      pageDiff: number
    ) => {
      const queryPageInt = parseInt(queryParam.page, 10);
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

      navigate({
        pathname: path,
        query: {...queryParam, cursor, page: nextPage},
      });
    },
    [navigate]
  );

  useEffect(() => {
    fetchOrgMembers(api, organization.slug).then(members => {
      setMemberList(indexMembersByProject(members));
    });
  }, [api, organization.slug]);

  const parsedQuery = useMemo(
    () => parseSearch(String(computedQueryParams.query ?? '')),
    [computedQueryParams.query]
  );

  const hasLogicBoolean = useMemo(
    () =>
      parsedQuery
        ? treeResultLocator<boolean>({
            tree: parsedQuery,
            noResultValue: false,
            visitorTest: ({token, returnResult}) => {
              return token.type === Token.LOGIC_BOOLEAN ? returnResult(true) : null;
            },
          })
        : false,
    [parsedQuery]
  );

  const {
    data: groupsData,
    isPending,
    isError: isQueryError,
    error: queryError,
    getResponseHeader,
    refetch,
  } = useApiQuery<Group[]>(
    [
      endpointPath ?? `/organizations/${organization.slug}/issues/`,
      {query: computedQueryParams},
    ],
    {
      staleTime: 0,
      enabled: !hasLogicBoolean,
    }
  );

  const pageLinks = getResponseHeader?.('Link') ?? null;
  const groups = groupsData ?? [];
  const errorDetail = hasLogicBoolean
    ? RELATED_ISSUES_BOOLEAN_QUERY_ERROR
    : (() => {
        const detail = (queryError as RequestError | undefined)?.responseJSON?.detail;
        if (typeof detail === 'string') {
          return detail;
        }
        if (detail?.message) {
          return detail.message;
        }
        return (queryError as RequestError | undefined)?.message ?? null;
      })();
  const errorData = errorDetail ? {detail: errorDetail} : null;
  const hasError = hasLogicBoolean || isQueryError;
  const loading = !hasLogicBoolean && isPending;

  useEffect(() => {
    if (!onFetchSuccess || !groupsData) {
      return;
    }

    onFetchSuccess(
      {
        error: false,
        errorData: null,
        groups: groupsData,
        loading: false,
        pageLinks,
        memberList,
      },
      handleCursorChange
    );
  }, [
    handleCursorChange,
    hasError,
    isPending,
    groupsData,
    memberList,
    onFetchSuccess,
    pageLinks,
  ]);

  const columns: GroupListColumn[] = useMemo(
    () => [...withColumns, 'firstSeen', 'lastSeen'],
    [withColumns]
  );

  if (hasError) {
    if (typeof renderErrorMessage === 'function' && errorData) {
      return renderErrorMessage(errorData, refetch);
    }

    return <LoadingError onRetry={refetch} />;
  }

  if (!loading && groups.length === 0) {
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
    computedQueryParams?.groupStatsPeriod === 'auto'
      ? computedQueryParams?.groupStatsPeriod
      : DEFAULT_STREAM_GROUP_STATS_PERIOD;

  return (
    <Fragment>
      <PanelContainer>
        <GroupListHeader withChart={!!withChart} withColumns={columns} />
        <PanelBody>
          {loading
            ? [...new Array(numPlaceholderRows)].map((_, i) => (
                <GroupPlaceholder key={i}>
                  <Placeholder height="50px" />
                </GroupPlaceholder>
              ))
            : groups.map(group => {
                const members = memberList?.hasOwnProperty(group.project.slug)
                  ? memberList[group.project.slug]
                  : undefined;

                return (
                  <StreamGroup
                    key={group.id}
                    id={group.id}
                    group={group}
                    canSelect={canSelectGroups}
                    withChart={withChart}
                    withColumns={columns}
                    memberList={members}
                    useFilteredStats={useFilteredStats}
                    useTintRow={useTintRow}
                    customStatsPeriod={customStatsPeriod}
                    statsPeriod={statsPeriod}
                    queryFilterDescription={queryFilterDescription}
                    source={source}
                    query={query}
                  />
                );
              })}
        </PanelBody>
      </PanelContainer>
      {withPagination && (
        <Pagination pageLinks={pageLinks} onCursor={handleCursorChange} />
      )}
    </Fragment>
  );
}

export default GroupList;

const GroupPlaceholder = styled('div')`
  padding: ${space(1)};

  &:not(:last-child) {
    border-bottom: solid 1px ${p => p.theme.innerBorder};
  }
`;

const PanelContainer = styled(Panel)`
  container-type: inline-size;
`;
