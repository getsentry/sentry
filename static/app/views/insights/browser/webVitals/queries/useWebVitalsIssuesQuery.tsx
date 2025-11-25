import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {IssueType, type Group, type ISSUE_TYPE_TO_ISSUE_TITLE} from 'sentry/types/group';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';

const DEFAULT_ISSUE_TYPES = [IssueType.WEB_VITALS];

type QueryProps = {
  issueTypes?: Array<keyof typeof ISSUE_TYPE_TO_ISSUE_TITLE>;
  transaction?: string;
  webVital?: WebVitals;
};

export function getIssueQueryFilter({
  issueTypes = DEFAULT_ISSUE_TYPES,
  webVital,
  transaction,
}: QueryProps) {
  const mutableSearch = MutableSearch.fromQueryObject({
    is: 'unresolved',
    'issue.type': `[${issueTypes.join(',')}]`,
  });
  if (transaction) {
    mutableSearch.addFilterValue('transaction', transaction);
  }
  // For issue.type:web_vitals, we also want to filter for a specific web_vital tag.
  // However, the issues api doesn't support OR conditions, so we can't apply a filter to the web_vital tag without it affecting all other filter conditions.
  // To get around this, we instead filter out all other web_vital tags except the one we want to filter for.
  if (webVital) {
    mutableSearch.addFilterValue(
      '!web_vital',
      `[${ORDER.filter(v => v !== webVital).join(',')}]`
    );
  }
  return mutableSearch.formatString();
}

function useWebVitalsIssuesQueryKey({
  issueTypes = DEFAULT_ISSUE_TYPES,
  webVital,
  transaction,
}: QueryProps): ApiQueryKey {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  return [
    `/organizations/${organization.slug}/issues/`,
    {
      query: {
        query: getIssueQueryFilter({issueTypes, transaction, webVital}),
        project: selection.projects,
        environment: selection.environments,
        ...normalizeDateTimeParams(selection.datetime),
        per_page: 6,
      },
    },
  ];
}

export function useWebVitalsIssuesQuery({
  issueTypes = DEFAULT_ISSUE_TYPES,
  webVital,
  transaction,
  enabled = true,
  pollInterval,
  eventIds,
}: QueryProps & {
  enabled?: boolean;
  eventIds?: string[];
  pollInterval?: number;
}) {
  return useApiQuery<Group[]>(
    useWebVitalsIssuesQueryKey({issueTypes, transaction, webVital}),
    {
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
    }
  );
}
