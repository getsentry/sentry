import {useQueries} from '@tanstack/react-query';

import type {Level} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/platform';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {QUERY_STALE_TIME} from './types';

export type AutofixStateKey =
  | 'review_pr'
  | 'code_changes_ready'
  | 'solution_ready'
  | 'needs_investigation'
  | 'merged';

export const SECTION_ORDER: AutofixStateKey[] = [
  'review_pr',
  'code_changes_ready',
  'solution_ready',
  'needs_investigation',
  'merged',
];

const SECTION_LIMIT = 100;
const REQUIRED_ISSUE_FILTER = 'has:issue.seer_last_run';

export interface OverviewIssue {
  count: string;
  id: string;
  lastSeen: string;
  level: Level;
  project: {slug: string; platform?: PlatformKey};
  seerAutofixLastTriggered: string | null;
  shortId: string;
  title: string;
  userCount: number;
}

export interface SectionResult {
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
