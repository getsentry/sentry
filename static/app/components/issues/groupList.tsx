import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
// eslint-disable-next-line no-restricted-imports
import {browserHistory} from 'react-router';
import * as qs from 'query-string';

import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {treeResultLocator} from 'sentry/components/searchSyntax/utils';
import StreamGroup, {
  DEFAULT_STREAM_GROUP_STATS_PERIOD,
} from 'sentry/components/stream/group';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Group} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {RELATED_ISSUES_BOOLEAN_QUERY_ERROR} from 'sentry/views/alerts/rules/metric/details/relatedIssuesNotAvailable';

import GroupListHeader from './groupListHeader';

type Props = {
  endpointPath: string;
  query: string;
  canSelectGroups?: boolean;
  customStatsPeriod?: TimePeriodType;
  narrowGroups?: boolean;
  onFetchSuccess?: (
    groupListState: {groups: Group[]; pageLinks: string | null},
    onCursor: (
      cursor: string,
      path: string,
      query: Record<string, any>,
      pageDiff: number
    ) => void
  ) => void;
  queryFilterDescription?: string;
  queryParams?: Record<string, number | string | string[] | undefined | null>;
  renderEmptyMessage?: () => React.ReactElement;
  renderErrorMessage?: ({detail: string}, retry?: () => void) => React.ReactElement;
  useFilteredStats?: boolean;
  useTintRow?: boolean;
  withChart?: boolean;
  withPagination?: boolean;
};

/** todo: memoize if necessary */
function GroupList({
  canSelectGroups = true,
  withChart = true,
  withPagination = true,
  useFilteredStats = true,
  useTintRow = true,
  narrowGroups = false,
  query,
  queryParams,
  endpointPath,
  renderErrorMessage,
  renderEmptyMessage,
  customStatsPeriod,
  queryFilterDescription,
}: Props) {
  const groups = useLegacyStore(GroupStore);
  useResetGroupStoreOnUnmount();
  const {isLoading, hasError, pageLinks, error, retry} = useFetchGroups({
    query,
    queryParams,
    endpointPath,
  });
  const memberList = useFetchMemberList();

  if (hasError) {
    return (
      <GroupListError
        renderErrorMessage={renderErrorMessage}
        errorData={error}
        retry={retry}
      />
    );
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!groups.length) {
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
    <Fragment>
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
              />
            );
          })}
        </PanelBody>
      </Panel>
      {withPagination && (
        <Pagination pageLinks={pageLinks} onCursor={handleCursorChange} />
      )}
    </Fragment>
  );
}

function GroupListError({
  renderErrorMessage,
  errorData,
  retry,
}: Pick<Props, 'renderErrorMessage'> & {
  errorData?: {detail: string};
  retry?: () => void;
}) {
  if (typeof renderErrorMessage === 'function' && errorData) {
    return renderErrorMessage(errorData, retry);
  }

  return <LoadingError onRetry={retry} />;
}

function useResetGroupStoreOnUnmount() {
  useEffect(() => {
    return () => {
      GroupStore.reset();
    };
  }, []);
}

function useFetchMemberList() {
  const api = useApi();
  const organization = useOrganization();
  const [membersList, setMemberList] = useState<ReturnType<
    typeof indexMembersByProject
  > | null>(null);

  useEffect(() => {
    api.clear();
    fetchOrgMembers(api, organization.slug).then(members => {
      setMemberList(indexMembersByProject(members));
    });
  }, [api, organization.slug]);

  return membersList;
}

function useFetchGroups({
  queryParams,
  query,
  endpointPath,
  onFetchSuccess,
}: Pick<Props, 'queryParams' | 'query' | 'endpointPath' | 'onFetchSuccess'>) {
  const {id: orgId} = useOrganization();
  const location = useLocation();
  const api = useApi();
  const [requestState, setRequestState] = useState<{
    hasError: boolean;
    isLoading: boolean;
    error?: {detail: string};
    pageLinks?: string | null;
  }>({
    isLoading: false,
    hasError: false,
  });

  const queryHasLogicBoolean = useMemo(() => {
    const parsedQuery = parseSearch(query);

    if (!parsedQuery) {
      return false;
    }

    return treeResultLocator<boolean>({
      tree: parsedQuery,
      noResultValue: false,
      visitorTest: ({token, returnResult}) => {
        return token.type === Token.LogicBoolean ? returnResult(true) : null;
      },
    });
  }, [query]);

  const path = endpointPath ?? `/organizations/${orgId}/issues/`;

  const requestEndpoint = `${path}?${qs.stringify(
    queryParams ?? {
      ...location.query,
      query,
      sort: 'new',
      limit: 50,
    }
  )}`;

  const fetchGroups = useCallback(async () => {
    api.clear();
    setRequestState({isLoading: true, hasError: false});
    GroupStore.loadInitialData([]);

    if (queryHasLogicBoolean) {
      setRequestState({
        isLoading: false,
        hasError: true,
        error: {detail: RELATED_ISSUES_BOOLEAN_QUERY_ERROR},
      });
    }

    try {
      const [data, _, response] = await api.requestPromise(requestEndpoint, {
        includeAllArgs: true,
      });

      const pageLinks = response?.getResponseHeader?.('Link') ?? null;

      GroupStore.add(data);
      setRequestState({isLoading: false, hasError: false, pageLinks});
      onFetchSuccess?.({groups: data, pageLinks}, handleCursorChange);
    } catch (error) {
      setRequestState({isLoading: false, hasError: true, error: error?.responseJSON});
    }
  }, [api, onFetchSuccess, queryHasLogicBoolean, requestEndpoint]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return {
    ...requestState,
    retry: fetchGroups,
  };
}

function handleCursorChange(
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

export default GroupList;
