import {useQueries} from '@tanstack/react-query';

import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {hasValidPr} from './buildOverviewRows';
import {type OverviewIssue, QUERY_STALE_TIME} from './types';

export function useValidPrIssues({
  enabled,
  issues,
}: {
  enabled: boolean;
  issues: OverviewIssue[];
}) {
  const organization = useOrganization();

  const results = useQueries({
    queries: issues.map(issue => ({
      ...apiOptions.as<{autofix: ExplorerAutofixState | null}>()(
        '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/',
        {
          path: {organizationIdOrSlug: organization.slug, issueId: issue.id},
          query: {mode: 'explorer'},
          staleTime: QUERY_STALE_TIME,
        }
      ),
      enabled,
    })),
  });

  return {
    isPending: enabled && results.some(result => result.isPending),
    validIssues: issues.filter((_, index) => {
      const result = results[index]!;
      return result.data ? hasValidPr(result.data.autofix) : false;
    }),
  };
}
