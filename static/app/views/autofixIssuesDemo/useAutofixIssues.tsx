import {useMemo} from 'react';
import {skipToken, useQueries, useQuery} from '@tanstack/react-query';

import {
  type ExplorerAutofixState,
  getOrderedAutofixSections,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

// Visible default query for the search bar. The required autofix filter below
// is always applied on top, so it isn't part of the editable query.
export const DEFAULT_ISSUE_QUERY = 'is:unresolved';

// Always applied to the issue query: only issues Seer has run autofix on.
export const REQUIRED_ISSUE_FILTER = 'has:issue.seer_last_run';

function withRequiredFilter(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return REQUIRED_ISSUE_FILTER;
  }
  return trimmed.includes(REQUIRED_ISSUE_FILTER)
    ? trimmed
    : `${trimmed} ${REQUIRED_ISSUE_FILTER}`;
}

// Runs filter: the explorer runs autofix creates. Combined with a
// ``group:[...]`` filter so we only fetch runs for the issues on the page.
const RUNS_QUERY = 'type:explorer source:autofix';

// Custom one-shot question asked about each run, sent to the endpoint as a
// repeatable `question` param (see organization_seer_runs.py). Edit this list
// to iterate on prompts without a backend change. Capped at 5 by the endpoint.
const DEMO_QUESTIONS = [
  'What was the most important bit of evidence while investigating this issue?',
  'What is the complexity of the fix? Count or estimate number of lines and files touched.',
];

// Keep the issue page size at/under the runs endpoint's outputs page cap (10)
// so a single runs request covers every group on the page.
const PER_PAGE = 10;

// The furthest phase an autofix run has reached, derived from its state.
// NOTE: 'pr_merged' is intentionally never produced here — the autofix state
// endpoint only reports up to "PR opened" (repo_pr_states.pr_creation_status
// tops out at 'completed'). GitHub merge status lives on sentry.PullRequest and
// would need a separate backend join to surface. Kept in the union so the UI
// can label it once that data is available.
export type AutofixPhase = 'rca' | 'planning' | 'coding' | 'pr_open' | 'pr_merged';

// Human labels for each phase.
export const AUTOFIX_PHASE_LABELS: Record<AutofixPhase, string> = {
  rca: 'Root cause',
  planning: 'Planning',
  coding: 'Coding',
  pr_open: 'PR open',
  pr_merged: 'PR merged',
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

// One answered question, mirrors the run output in
// src/sentry/api/serializers/models/seer_run.py.
interface RunQuestion {
  answer: string;
  key: string;
  // The question text, echoed back only for user-supplied questions.
  question?: string;
}

// Subset of the runs list response we consume
// (src/sentry/api/serializers/models/seer_run.py).
interface SeerRun {
  groupId: string | null;
  id: string;
  lastTriggeredAt: string;
  // Present only when ?outputs is requested (and the feature is on).
  outputs?: RunQuestion[];
}

// Subset of the issue-stream group we render.
interface Issue {
  culprit: string;
  id: string;
  seerAutofixLastTriggered: string | null;
  seerFixabilityScore: number | null;
  shortId: string;
  title: string;
}

export interface AutofixIssue extends Issue {
  // The furthest autofix phase this issue's run has reached, or null when the
  // per-group autofix state hasn't loaded yet / has no run.
  autofixPhase: AutofixPhase | null;
  // Whether the per-group autofix state is still loading.
  autofixPhasePending: boolean;
  // The most recent explorer/autofix run for this issue's group, if any.
  run: SeerRun | null;
}

interface UseAutofixIssuesParams {
  cursor?: string;
  query?: string;
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
 * with its most recent Seer run (including one-shot outputs). The runs request
 * is scoped to exactly the groups on the page via ``group:[...]``, so we make
 * one extra request per page rather than fetching every run in the org.
 */
export function useAutofixIssues({
  query,
  cursor,
}: UseAutofixIssuesParams): UseAutofixIssuesResult {
  const organization = useOrganization();

  // 1. Page of autofix issues from the issue stream.
  const issuesQuery = useQuery({
    ...apiOptions.as<Issue[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        query: withRequiredFilter(query ?? ''),
        cursor,
        project: -1,
        statsPeriod: '90d',
        limit: PER_PAGE,
      },
      staleTime: 30_000,
    }),
    select: selectJsonWithHeaders,
  });

  const issues = useMemo(() => issuesQuery.data?.json ?? [], [issuesQuery.data]);
  const groupIds = useMemo(() => issues.map(issue => issue.id), [issues]);
  const runsEnabled = groupIds.length > 0;

  // 2. Enrich with the runs for exactly those groups (one group-scoped request).
  const runsQuery = useQuery(
    apiOptions.as<SeerRun[]>()('/organizations/$organizationIdOrSlug/seer/runs/', {
      path: runsEnabled ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        query: `${RUNS_QUERY} group:[${groupIds.join(',')}]`,
        question: DEMO_QUESTIONS,
      },
      staleTime: 30_000,
    })
  );

  // 3. Fetch the full autofix state per group to derive its phase. This is one
  // request per issue on the page (bounded by PER_PAGE) -- the runs list
  // endpoint doesn't expose fine-grained phase, so we read each run's state
  // ("the whole history") directly. useQueries preserves groupIds order.
  const autofixResults = useQueries({
    queries: groupIds.map(groupId =>
      apiOptions.as<{autofix: ExplorerAutofixState | null}>()(
        '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/',
        {
          path: {organizationIdOrSlug: organization.slug, issueId: groupId},
          query: {mode: 'explorer'},
          staleTime: 30_000,
        }
      )
    ),
  });

  // 4. Join runs (outputs) and autofix phase onto each issue by group id. Runs
  // come back ordered by last_triggered_at desc, so the first run seen for a
  // group is the latest.
  const runByGroupId = useMemo(() => {
    const map = new Map<string, SeerRun>();
    for (const run of runsQuery.data ?? []) {
      if (run.groupId && !map.has(run.groupId)) {
        map.set(run.groupId, run);
      }
    }
    return map;
  }, [runsQuery.data]);

  // Computed each render (not memoized): useQueries returns a new array every
  // render, so it can't go in a useMemo dep array (@tanstack/query/no-unstable-
  // deps). The map is cheap -- at most PER_PAGE rows.
  const enriched: AutofixIssue[] = issues.map((issue, i) => {
    const autofixResult = autofixResults[i];
    return {
      ...issue,
      run: runByGroupId.get(issue.id) ?? null,
      autofixPhase: deriveAutofixPhase(autofixResult?.data?.autofix ?? null),
      autofixPhasePending: autofixResult?.isPending ?? false,
    };
  });

  return {
    issues: enriched,
    isPending: issuesQuery.isPending || (runsEnabled && runsQuery.isPending),
    isError: issuesQuery.isError || runsQuery.isError,
    refetch: () => {
      issuesQuery.refetch();
      // Only refetch the runs query when it's enabled; refetching a disabled
      // (skipToken) query logs a React Query error.
      if (runsEnabled) {
        runsQuery.refetch();
      }
      autofixResults.forEach(result => result.refetch());
    },
    pageLinks: issuesQuery.data?.headers.Link,
  };
}
