import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {Group, ISSUE_TYPE_TO_ISSUE_TITLE} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export function getIssueQueryFilter(
  performanceIssues: Array<keyof typeof ISSUE_TYPE_TO_ISSUE_TITLE>
) {
  return `is:unresolved issue.type:[${performanceIssues?.join(',')}]`;
}

export function useWebVitalsIssuesQuery(
  performanceIssues: Array<keyof typeof ISSUE_TYPE_TO_ISSUE_TITLE>
) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  return useApiQuery<Group[]>(
    [
      `/organizations/${organization.slug}/issues/`,
      {
        query: {
          query: getIssueQueryFilter(performanceIssues),
          project: selection.projects,
          environment: selection.environments,
          ...normalizeDateTimeParams(selection.datetime),
          per_page: 6,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: Boolean(performanceIssues?.length),
    }
  );
}
