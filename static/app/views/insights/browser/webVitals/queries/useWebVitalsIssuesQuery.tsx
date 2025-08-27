import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {Group, ISSUE_TYPE_TO_ISSUE_TITLE} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export function getIssueQueryFilter({
  issueTypes,
  transaction,
}: {
  issueTypes: Array<keyof typeof ISSUE_TYPE_TO_ISSUE_TITLE>;
  transaction?: string;
}) {
  return `is:unresolved issue.type:[${issueTypes?.join(',')}]${defined(transaction) ? ` transaction:${transaction}` : ''}`;
}

export function useWebVitalsIssuesQuery({
  issueTypes,
  transaction,
  enabled = true,
}: {
  issueTypes: Array<keyof typeof ISSUE_TYPE_TO_ISSUE_TITLE>;
  enabled?: boolean;
  transaction?: string;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  return useApiQuery<Group[]>(
    [
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
    ],
    {
      staleTime: 0,
      enabled: Boolean(issueTypes?.length) && enabled,
    }
  );
}
