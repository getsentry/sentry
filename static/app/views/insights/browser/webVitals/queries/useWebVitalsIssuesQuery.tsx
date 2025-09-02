import {useCallback} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {IssueType, type Group, type ISSUE_TYPE_TO_ISSUE_TITLE} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {useApiQuery, useQueryClient, type ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export const POLL_INTERVAL = 1000;

const DEFAULT_ISSUE_TYPES = [IssueType.WEB_VITALS];

type QueryProps = {
  issueTypes?: Array<keyof typeof ISSUE_TYPE_TO_ISSUE_TITLE>;
  transaction?: string;
};

export function getIssueQueryFilter({
  issueTypes = DEFAULT_ISSUE_TYPES,
  transaction,
}: QueryProps) {
  return `is:unresolved issue.type:[${issueTypes?.join(',')}]${defined(transaction) ? ` transaction:${transaction}` : ''}`;
}

function useWebVitalsIssuesQueryKey({
  issueTypes = DEFAULT_ISSUE_TYPES,
  transaction,
}: QueryProps): ApiQueryKey {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  return [
    `/organizations/${organization.slug}/issues/`,
    {
      query: {
        query: getIssueQueryFilter({issueTypes, transaction}),
        project: selection.projects,
        environment: selection.environments,
        ...normalizeDateTimeParams(selection.datetime),
        per_page: 6,
      },
    },
  ];
}

export function useInvalidateWebVitalsIssuesQuery({
  issueTypes = DEFAULT_ISSUE_TYPES,
  transaction,
}: QueryProps) {
  const queryClient = useQueryClient();
  const queryKey = useWebVitalsIssuesQueryKey({issueTypes, transaction});
  return useCallback(() => {
    queryClient.setQueryData(queryKey, undefined);
    queryClient.invalidateQueries({queryKey});
  }, [queryClient, queryKey]);
}

export function useWebVitalsIssuesQuery({
  issueTypes = DEFAULT_ISSUE_TYPES,
  transaction,
  enabled = true,
  pollInterval,
  eventIds,
}: QueryProps & {
  enabled?: boolean;
  eventIds?: string[];
  pollInterval?: number;
}) {
  return useApiQuery<Group[]>(useWebVitalsIssuesQueryKey({issueTypes, transaction}), {
    staleTime: 0,
    enabled: Boolean(issueTypes?.length) && enabled,
    refetchInterval: query => {
      // Poll until the number of issues in the results array matches the number of expected eventIds.
      if (!pollInterval || !eventIds) {
        return false;
      }
      const result = query.state.data?.[0];
      return result && Array.isArray(result) && result.length < eventIds.length
        ? pollInterval
        : false;
    },
  });
}
