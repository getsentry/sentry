import {useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';

import {
  type ExplorerAutofixState,
  getOrderedAutofixSections,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {Level} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/platform';
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

// Issues per page; also bounds the per-group runs/state request fan-out.
const PER_PAGE = 10;

export type AutofixPhase = 'rca' | 'planning' | 'coding' | 'pr_open' | 'pr_merged';

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
// src/sentry/api/serializers/models/seer_run.py
export interface RunQuestion {
  answer: string;
  key: string;
  // The question text, echoed back only for user-supplied questions.
  question?: string;
}

// A pull request linked to a run, serialized by PullRequestSerializer
// src/sentry/api/serializers/models/pullrequest.py
// `status` is 'open' | 'merged' | 'closed' | 'draft' | 'unknown'.
interface RunPullRequest {
  status: string | null;
  mergedAt?: string | null;
}

// Subset of the runs list response we consume
// src/sentry/api/serializers/models/seer_run.py
interface SeerRun {
  groupId: string | null;
  id: string;
  lastTriggeredAt: string;
  source: string | null;
  // Present only when ?outputs is requested.
  outputs?: RunQuestion[];
  // Linked PRs with merge status.
  pullRequests?: RunPullRequest[];
}

// Subset of the issue-stream group we render.
interface Issue {
  // Event count over the stats period. Endpoint sadly returns a string.
  count: string;
  culprit: string;
  id: string;
  lastSeen: string;
  level: Level;
  project: {slug: string; platform?: PlatformKey};
  seerAutofixLastTriggered: string | null;
  seerFixabilityScore: number | null;
  shortId: string;
  title: string;
  userCount: number;
}

export interface AutofixIssue extends Issue {
  autofixPhase: AutofixPhase | null;
  autofixPhasePending: boolean;
  autofixState: ExplorerAutofixState | null;
  run: SeerRun | null;
}

interface UseAutofixIssuesParams {
  cursor?: string;
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
        project: -1,
        statsPeriod: '90d',
        // Explicit endpoint default: last-seen desc selects the issues still
        // actively occurring as the candidate pool; callers order the loaded
        // page themselves (the overview applies a triage sort).
        sort: 'date',
        limit: PER_PAGE,
      },
      staleTime: 30_000,
    }),
    select: selectJsonWithHeaders,
  });

  const issues = useMemo(() => issuesQuery.data?.json ?? [], [issuesQuery.data]);
  const groupIds = useMemo(() => issues.map(issue => issue.id), [issues]);
  const runsEnabled = groupIds.length > 0;

  // 2. Enrich with each group's latest run, one request per group with
  // per_page=1. A single batched group:[...] request looked cheaper, but the
  // endpoint caps outputs-enabled pages at 10 runs ordered by recency — when
  // the page's groups collectively have more runs than that, the oldest
  // groups' runs fall off and their issues silently lose all answers. Per-
  // group requests make coverage guaranteed with the same total one-shot work.
  const runResults = useQueries({
    queries: groupIds.map(groupId =>
      apiOptions.as<SeerRun[]>()('/organizations/$organizationIdOrSlug/seer/runs/', {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          query: `${runsQueryFilter} group:${groupId}`,
          question: questions,
          per_page: 1,
        },
        staleTime: 30_000,
      })
    ),
  });

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

  // 4. Join each group's run (outputs) and autofix phase onto its issue.
  // Computed each render (not memoized): useQueries returns a new array every
  // render, so it can't go in a useMemo dep array (@tanstack/query/no-unstable-
  // deps). The map is cheap -- at most PER_PAGE rows.
  const enriched: AutofixIssue[] = issues.map((issue, i) => {
    const autofixResult = autofixResults[i];
    const autofixState = autofixResult?.data?.autofix ?? null;
    // The server already scopes each request to its group; the find() guards
    // against mocks/responses carrying runs for other groups.
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
