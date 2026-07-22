import {useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';

import {
  type ExplorerAutofixState,
  getOrderedAutofixSections,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  type OverviewIssue,
  QUERY_STALE_TIME,
  REQUIRED_ISSUE_FILTER,
  RUNS_QUERY,
  type SeerRun,
} from 'sentry/views/seerWorkflows/overview/types';

export {REQUIRED_ISSUE_FILTER};

// Visible default query for the search bar. The required autofix filter below
// is always applied on top, so it isn't part of the editable query.
export const DEFAULT_ISSUE_QUERY = 'is:unresolved';

function withRequiredFilter(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return REQUIRED_ISSUE_FILTER;
  }
  return trimmed.includes(REQUIRED_ISSUE_FILTER)
    ? trimmed
    : `${trimmed} ${REQUIRED_ISSUE_FILTER}`;
}

// Custom one-shot questions asked about each run, sent to the endpoint as a
// repeatable `question` param (see organization_seer_runs.py). Capped at 5 by
// the endpoint.
const DEMO_QUESTIONS = [
  'What was the most important bit of evidence while investigating this issue?',
  'What is the complexity of the fix? Count or estimate number of lines and files touched.',
];

// Issues per page; also bounds the per-group runs/state request fan-out.
const PER_PAGE = 10;

export type AutofixPhase = 'rca' | 'planning' | 'coding' | 'pr_open' | 'pr_merged';

export const AUTOFIX_PHASE_LABELS: Record<AutofixPhase, string> = {
  rca: t('Root cause'),
  planning: t('Planning'),
  coding: t('Coding'),
  pr_open: t('PR open'),
  pr_merged: t('PR merged'),
};

/**
 * Derive the furthest phase a run has reached from its full autofix state.
 *
 * Reuses getOrderedAutofixSections (the same bucketing the Seer explorer UI
 * uses): sections are ordered by first-seen step, with synthetic
 * 'pull_request'/'coding_agents' sections appended last, so the final section
 * is the furthest-progressed phase. Returns null when there is no run.
 */
function deriveAutofixPhase(runState: ExplorerAutofixState | null): AutofixPhase | null {
  if (!runState) {
    return null;
  }
  const sections = getOrderedAutofixSections(runState);
  const lastStep = sections[sections.length - 1]?.step;
  switch (lastStep) {
    case 'pull_request':
      return 'pr_open';
    case 'coding_agents':
    case 'code_changes':
      return 'coding';
    case 'solution':
      return 'planning';
    case 'root_cause':
      return 'rca';
    default:
      return null;
  }
}

// The overview's issue shape plus the two extra fields this demo renders.
interface Issue extends OverviewIssue {
  culprit: string;
  seerFixabilityScore: number | null;
}

export interface AutofixIssue extends Issue {
  autofixPhase: AutofixPhase | null;
  autofixPhasePending: boolean;
  autofixState: ExplorerAutofixState | null;
  run: SeerRun | null;
}

interface UseAutofixIssuesParams {
  cursor?: string;
  // Gates the issues request; pass page-filters readiness so the initial
  // fetch waits for the restored project selection. Defaults to true.
  enabled?: boolean;
  // Fetch exactly these group ids instead of searching the stream. The
  // endpoint ignores every other query component in this mode, so a
  // deep-linked issue resolves even outside the list's filters/pagination.
  groupIds?: string[];
  // Project ids to scope the issue stream to (page-filters selection: [] is
  // "My Projects", [-1] is all). Defaults to all accessible projects.
  projects?: number[];
  query?: string;
  // One-shot questions asked about each run (repeatable `question` param,
  // capped at 5 by the endpoint). Defaults to this page's demo set.
  questions?: string[];
  // Runs-endpoint filter to enrich issues with. Defaults to the explorer runs
  // autofix creates; pass e.g. 'type:explorer' to include all trigger sources.
  runsQuery?: string;
}

interface UseAutofixIssuesResult {
  isError: boolean;
  isPending: boolean;
  issues: AutofixIssue[];
  refetch: () => void;
  pageLinks?: string;
}

/**
 * Fetches a page of autofix issues from the issue stream and enriches each one
 * with its most recent Seer run (including one-shot outputs) and its autofix
 * state — one runs request and one state request per group on the page.
 */
export function useAutofixIssues({
  query,
  cursor,
  enabled = true,
  groupIds: pinnedGroupIds,
  projects,
  questions = DEMO_QUESTIONS,
  runsQuery: runsQueryFilter = RUNS_QUERY,
}: UseAutofixIssuesParams): UseAutofixIssuesResult {
  const organization = useOrganization();

  // 1. Page of autofix issues from the issue stream.
  const issuesQuery = useQuery({
    ...apiOptions.as<Issue[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        query: withRequiredFilter(query ?? ''),
        cursor,
        group: pinnedGroupIds,
        // In group-id mode the page-filters project selection must not hide
        // the deep-linked issue — the backend still enforces access.
        project: pinnedGroupIds ? -1 : (projects ?? -1),
        statsPeriod: '90d',
        // Explicit endpoint default: last-seen desc selects the issues still
        // actively occurring as the candidate pool; callers order the loaded
        // page themselves (the overview applies a triage sort).
        sort: 'date',
        limit: PER_PAGE,
      },
      staleTime: QUERY_STALE_TIME,
    }),
    enabled,
    select: selectJsonWithHeaders,
  });

  const issues = useMemo(() => issuesQuery.data?.json ?? [], [issuesQuery.data]);
  const groupIds = useMemo(() => issues.map(issue => issue.id), [issues]);
  const runsEnabled = groupIds.length > 0;

  // One request per group (per_page=1): the endpoint caps outputs-enabled pages
  // at 10 runs by recency, so a batched group:[...] request would silently drop
  // the oldest groups' runs.
  const runResults = useQueries({
    queries: groupIds.map(groupId =>
      apiOptions.as<SeerRun[]>()('/organizations/$organizationIdOrSlug/seer/runs/', {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          query: `${runsQueryFilter} group:${groupId}`,
          question: questions,
          per_page: 1,
        },
        staleTime: QUERY_STALE_TIME,
      })
    ),
  });

  // 3. Fetch the full autofix state per group to derive its phase. This is one
  // request per issue on the page (bounded by PER_PAGE) -- the runs list
  // endpoint doesn't expose fine-grained phase, so we read each run's state
  // directly. useQueries preserves groupIds order.
  const autofixResults = useQueries({
    queries: groupIds.map(groupId =>
      apiOptions.as<{autofix: ExplorerAutofixState | null}>()(
        '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/',
        {
          path: {organizationIdOrSlug: organization.slug, issueId: groupId},
          query: {mode: 'explorer'},
          staleTime: QUERY_STALE_TIME,
        }
      )
    ),
  });

  // 4. Join each group's run (outputs) and autofix phase onto its issue.
  // Computed each render (not memoized): useQueries returns a new array every
  // render, so it can't go in a useMemo dep array (@tanstack/query/no-unstable-
  // deps). The map is cheap -- at most PER_PAGE rows.
  const enriched: AutofixIssue[] = issues.map((issue, i) => {
    const autofixResult = autofixResults[i];
    const autofixState = autofixResult?.data?.autofix ?? null;
    // The server scopes each request to its group; find() guards against a
    // response carrying runs for another group.
    const runs = runResults[i]?.data;
    const run = runs?.find(candidate => candidate.groupId === issue.id) ?? null;
    return {
      ...issue,
      run,
      autofixPhase: deriveAutofixPhase(autofixState),
      autofixPhasePending: autofixResult?.isPending ?? false,
      autofixState,
    };
  });

  return {
    issues: enriched,
    isPending:
      issuesQuery.isPending ||
      (runsEnabled && runResults.some(result => result.isPending)),
    // A failed per-group runs request degrades that row to run-less rather
    // than erroring the whole page.
    isError: issuesQuery.isError,
    refetch: () => {
      issuesQuery.refetch();
      runResults.forEach(result => result.refetch());
      autofixResults.forEach(result => result.refetch());
    },
    pageLinks: issuesQuery.data?.headers.Link,
  };
}
