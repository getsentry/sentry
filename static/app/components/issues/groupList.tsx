import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import * as qs from 'query-string';

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
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorData, setErrorData] = useState<{detail: string} | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [pageLinks, setPageLinks] = useState<string | null>(null);
  const [memberList, setMemberList] = useState<
    ReturnType<typeof indexMembersByProject> | undefined
  >(undefined);

  const previousPropsRef = useRef<
    | {
        orgSlug: string;
        endpointPath?: string;
        query?: string;
        queryParams?: Record<string, number | string | string[] | undefined | null>;
      }
    | undefined
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

  const getGroupListEndpoint = useCallback(() => {
    // TODO: Split up the query parameters and the URL. This will make it much easier to mock the endpoint.
    const path = endpointPath ?? `/organizations/${organization.slug}/issues/`;

    return `${path}?${qs.stringify(computedQueryParams)}`;
  }, [computedQueryParams, endpointPath, organization.slug]);

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

  const onGroupChange = useCallback(() => {
    const storeGroups = GroupStore.getAllItems() as Group[];
    setGroups(prevGroups =>
      isEqual(storeGroups, prevGroups) ? prevGroups : storeGroups
    );
  }, []);

  const fetchData = useCallback(async () => {
    GroupStore.loadInitialData([]);
    api.clear();

    setLoading(true);
    setError(false);
    setErrorData(null);

    fetchOrgMembers(api, organization.slug).then(members => {
      setMemberList(indexMembersByProject(members));
    });

    const endpoint = getGroupListEndpoint();
    const parsedQuery = parseSearch(String(computedQueryParams.query ?? ''));
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
      setError(true);
      setErrorData({detail: RELATED_ISSUES_BOOLEAN_QUERY_ERROR});
      setLoading(false);
      return;
    }

    try {
      const [data, , jqXHR] = await api.requestPromise(endpoint, {
        includeAllArgs: true,
      });

      GroupStore.add(data);
      const nextGroups = GroupStore.getAllItems() as Group[];
      const nextPageLinks = jqXHR?.getResponseHeader('Link') ?? null;

      setGroups(prevGroups =>
        isEqual(prevGroups, nextGroups) ? prevGroups : nextGroups
      );
      setError(false);
      setErrorData(null);
      setLoading(false);
      setPageLinks(nextPageLinks);

      onFetchSuccess?.(
        {
          error: false,
          errorData: null,
          groups: nextGroups,
          loading: false,
          pageLinks: nextPageLinks,
          memberList,
        },
        handleCursorChange
      );
    } catch (fetchError: any) {
      setError(true);
      setErrorData(fetchError.responseJSON);
      setLoading(false);
    }
  }, [
    api,
    computedQueryParams.query,
    getGroupListEndpoint,
    handleCursorChange,
    memberList,
    onFetchSuccess,
    organization.slug,
  ]);

  useEffect(() => {
    const ignoredQueryParams = ['end'];
    const prev = previousPropsRef.current;
    const queryChanged =
      !prev ||
      !isEqual(
        omit(prev.queryParams ?? {}, ignoredQueryParams),
        omit(computedQueryParams ?? {}, ignoredQueryParams)
      );
    const shouldFetch =
      !prev ||
      prev.orgSlug !== organization.slug ||
      prev.endpointPath !== endpointPath ||
      prev.query !== query ||
      queryChanged;

    if (shouldFetch) {
      fetchData();
      previousPropsRef.current = {
        orgSlug: organization.slug,
        endpointPath,
        query,
        queryParams: computedQueryParams,
      };
    }
  }, [computedQueryParams, endpointPath, fetchData, organization.slug, query]);

  useEffect(() => {
    const unsubscribe = GroupStore.listen(onGroupChange, undefined);

    return () => {
      unsubscribe();
      GroupStore.reset();
    };
  }, [onGroupChange]);

  const columns: GroupListColumn[] = useMemo(
    () => [...withColumns, 'firstSeen', 'lastSeen'],
    [withColumns]
  );

  if (error) {
    if (typeof renderErrorMessage === 'function' && errorData) {
      return renderErrorMessage(errorData, fetchData);
    }

    return <LoadingError onRetry={fetchData} />;
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
