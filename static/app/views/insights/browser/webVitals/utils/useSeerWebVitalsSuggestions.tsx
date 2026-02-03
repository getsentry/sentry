import {
  makeAutofixQueryKey,
  type AutofixResponse,
} from 'sentry/components/events/autofix/useAutofix';
import {IssueType} from 'sentry/types/group';
import {fetchDataQuery, useQueries, type UseQueryResult} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useWebVitalsIssuesQuery} from 'sentry/views/insights/browser/webVitals/queries/useWebVitalsIssuesQuery';
import {useHasSeerWebVitalsSuggestions} from 'sentry/views/insights/browser/webVitals/utils/useHasSeerWebVitalsSuggestions';

// Given a transaction name, fetches web vital issues + seer suggestions
export function useSeerWebVitalsSuggestions({
  transaction,
  enabled = true,
}: {
  transaction: string;
  enabled?: boolean;
}) {
  const hasSeerWebVitalsSuggestions = useHasSeerWebVitalsSuggestions();
  const organization = useOrganization();

  const {data: issues, isLoading} = useWebVitalsIssuesQuery({
    issueTypes: [IssueType.WEB_VITALS],
    transaction,
    enabled: enabled && hasSeerWebVitalsSuggestions,
  });

  const autofixQueries: Array<UseQueryResult<AutofixResponse[], Error>> = useQueries({
    queries: (issues ?? []).map(issue => {
      const queryKey = makeAutofixQueryKey(organization.slug, issue.id);
      return {
        queryKey,
        queryFn: fetchDataQuery,
        staleTime: Infinity,
        enabled: !isLoading && enabled && hasSeerWebVitalsSuggestions,
        retry: false,
      };
    }),
  });

  const isLoadingAutofix = autofixQueries.some(query => query.isPending);
  const autofix = autofixQueries
    .map(data => data.data?.[0]?.autofix ?? null)
    .filter(data => data !== null);

  return {
    data: {
      issues,
      autofix:
        autofix.length === 0 || autofix.length !== issues?.length ? undefined : autofix,
    },
    isLoading: isLoading || isLoadingAutofix,
  };
}
