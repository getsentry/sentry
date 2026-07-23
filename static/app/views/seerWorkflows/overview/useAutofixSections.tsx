import {useQueries} from '@tanstack/react-query';

import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  type AutofixStateKey,
  type OverviewIssue,
  QUERY_STALE_TIME,
  REQUIRED_ISSUE_FILTER,
  SECTION_ORDER,
} from './types';

export const SECTION_LIMIT = 100;

interface SectionResult {
  count: number | undefined;
  isError: boolean;
  isPending: boolean;
  issues: OverviewIssue[];
  key: AutofixStateKey;
  refetch: () => void;
}

export function useAutofixSections({
  enabled,
  projects,
  sort,
  statsPeriod,
}: {
  enabled: boolean;
  projects: number[];
  sort: 'date' | 'freq';
  statsPeriod: string;
}) {
  const organization = useOrganization();

  const results = useQueries({
    queries: SECTION_ORDER.map(key => ({
      ...apiOptions.as<OverviewIssue[]>()(
        '/organizations/$organizationIdOrSlug/issues/',
        {
          path: {organizationIdOrSlug: organization.slug},
          query: {
            query: `${REQUIRED_ISSUE_FILTER} issue.autofix_state:${key}`,
            project: projects,
            statsPeriod,
            sort,
            limit: SECTION_LIMIT,
          },
          staleTime: QUERY_STALE_TIME,
        }
      ),
      enabled,
      select: (data: ApiResponse<OverviewIssue[]>) => selectJsonWithHeaders(data),
    })),
  });

  const sections: SectionResult[] = SECTION_ORDER.map((key, index) => {
    const result = results[index]!;
    const issues = result.data?.json ?? [];
    return {
      key,
      issues,
      count: result.data?.headers['X-Hits'] ?? (result.data ? issues.length : undefined),
      isPending: result.isPending,
      isError: result.isError,
      refetch: () => result.refetch(),
    };
  });

  return {
    sections,
    isPending: results.some(result => result.isPending),
    isError: results.every(result => result.isError),
    refetch: () => results.forEach(result => result.refetch()),
  };
}
