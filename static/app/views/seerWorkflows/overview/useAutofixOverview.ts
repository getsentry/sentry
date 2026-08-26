import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {
  type AutofixOverviewResponse,
  type AutofixScmInfoResponse,
  type MilestoneKey,
  type OverviewPullRequest,
  type OverviewRun,
  OVERVIEW_SECTIONS,
  type OverviewSort,
  PIPELINE,
  POLL_INTERVAL,
  QUERY_STALE_TIME,
} from './types';

export interface MilestoneAdvance {
  fromMilestone: MilestoneKey;
  run: OverviewRun;
  toMilestone: MilestoneKey;
}

const FILL_BY_SECTION = new Map(PIPELINE.map(stage => [stage.key, stage.fill]));
const MILESTONE_RANK = new Map<MilestoneKey, number>(
  OVERVIEW_SECTIONS.map(section => [
    section.milestone,
    FILL_BY_SECTION.get(section.key) ?? 0,
  ])
);

function milestoneByRun(data: AutofixOverviewResponse): Map<string, MilestoneKey> {
  const map = new Map<string, MilestoneKey>();
  for (const [milestone, runs] of Object.entries(data.runsByMilestone)) {
    for (const run of runs) {
      map.set(run.seerRunId, milestone as MilestoneKey);
    }
  }
  return map;
}

export function detectMilestoneAdvances(
  prev: AutofixOverviewResponse | undefined,
  next: AutofixOverviewResponse | undefined
): MilestoneAdvance[] {
  if (!prev || !next) {
    return [];
  }
  const prevMilestones = milestoneByRun(prev);
  const advances: MilestoneAdvance[] = [];
  for (const [milestone, runs] of Object.entries(next.runsByMilestone)) {
    const toMilestone = milestone as MilestoneKey;
    for (const run of runs) {
      const fromMilestone = prevMilestones.get(run.seerRunId);
      if (
        fromMilestone !== undefined &&
        (MILESTONE_RANK.get(toMilestone) ?? 0) > (MILESTONE_RANK.get(fromMilestone) ?? 0)
      ) {
        advances.push({run, fromMilestone, toMilestone});
      }
    }
  }
  return advances;
}

// Overlays the window's SCM fields (checks/review/files) onto the matching poll
// PR by id, so the poll's live PR identity/status isn't clobbered by a snapshot.
function overlayPullRequest(
  base: OverviewPullRequest,
  scm: OverviewPullRequest
): OverviewPullRequest {
  return {
    ...base,
    checksStatus: scm.checksStatus,
    reviewStatus: scm.reviewStatus,
    files: scm.files,
    failedCheckDetails: scm.failedCheckDetails,
    repoName: base.repoName ?? scm.repoName,
  };
}

// Merges each fetched window's SCM detail onto the poll's live PRs per run;
// unfetched runs and uncovered PRs keep poll data, so no PR link is dropped.
function mergeScmInfo(
  base: AutofixOverviewResponse,
  scmByRunId: Map<string, OverviewPullRequest[]>
): AutofixOverviewResponse {
  if (scmByRunId.size === 0) {
    return base;
  }
  const runsByMilestone = Object.fromEntries(
    Object.entries(base.runsByMilestone).map(([milestone, runs]) => [
      milestone,
      runs.map(run => {
        const enriched = scmByRunId.get(run.seerRunId);
        if (!enriched) {
          return run;
        }
        const scmById = new Map(enriched.map(pr => [pr.id, pr]));
        return {
          ...run,
          pullRequests: run.pullRequests.map(pr => {
            const scm = scmById.get(pr.id);
            return scm ? overlayPullRequest(pr, scm) : pr;
          }),
        };
      }),
    ])
  ) as AutofixOverviewResponse['runsByMilestone'];
  return {...base, runsByMilestone};
}

// Progressive load: the 10s status+Snuba poll paints cards fast; slow GitHub
// PR/SCM detail is windowed lazily, only for cards scrolled into view.
export function useAutofixOverview({
  organization,
  selection,
  sort,
  enabled,
}: {
  enabled: boolean;
  organization: Organization;
  selection: PageFilters;
  sort: OverviewSort;
}) {
  const queryClient = useQueryClient();

  const overviewQuery = (query: {
    expand?: Array<'issueStats' | 'status' | 'projectConfig'>;
  }) =>
    apiOptions.as<AutofixOverviewResponse>()(
      '/organizations/$organizationIdOrSlug/seer/autofix-overview/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          project: selection.projects,
          ...normalizeDateTimeParams(selection.datetime),
          // Default sort keeps the URL clean and adds no backend Snuba work.
          ...(sort === 'seer' ? {} : {sort}),
          ...query,
        },
        staleTime: QUERY_STALE_TIME,
      }
    );

  const statusPollQuery = useQuery({
    ...overviewQuery({expand: ['status', 'issueStats']}),
    enabled,
    refetchInterval: POLL_INTERVAL,
  });

  const projectConfigQuery = useQuery({
    ...overviewQuery({expand: ['projectConfig']}),
    enabled,
  });

  const scmInfoQueryOptions = useCallback(
    (runIds: string[]) =>
      apiOptions.as<AutofixScmInfoResponse>()(
        '/organizations/$organizationIdOrSlug/seer/autofix-scm-info/',
        {
          path: {organizationIdOrSlug: organization.slug},
          query: {
            // Same project scope as the poll so the endpoint resolves the same
            // runs; otherwise All-Projects/extra-access runs stay un-enriched.
            project: selection.projects,
            // Sorted so concurrent identical windows share one request.
            runIds: runIds.toSorted(),
          },
          // Within-scope dedup is handled by requestedRunIdsRef, so freshness is
          // ours to manage: always hit the network so a scope reset re-fetches.
          staleTime: 0,
        }
      ),
    [organization.slug, selection.projects]
  );

  // Requested ids (dedup) live in a ref so a window request never re-reads state
  // during render; the shimmer clears off `settledRunIds`.
  const requestedRunIdsRef = useRef<Set<string>>(new Set());
  const [settledRunIds, setSettledRunIds] = useState<Set<string>>(() => new Set());
  const [scmByRunId, setScmByRunId] = useState<Map<string, OverviewPullRequest[]>>(
    () => new Map()
  );
  const scopeGenerationRef = useRef(0);

  // Fetches one positional window of PR-bearing runs (the caller partitions runs
  // by render order). Any card in a window scrolling into view pulls the whole
  // window, so the runs just below it are enriched before they are reached.
  const requestScmWindow = useCallback(
    (runIds: string[]) => {
      const fresh = runIds.filter(id => !requestedRunIdsRef.current.has(id));
      if (fresh.length === 0) {
        return;
      }
      for (const id of fresh) {
        requestedRunIdsRef.current.add(id);
      }
      // Snapshot the scope so a window landing after a scope change is dropped.
      const generation = scopeGenerationRef.current;
      // Mark the window settled once its request finishes (success or failure);
      // the shimmer is on by default for un-enriched cards until then.
      const settle = () => {
        if (scopeGenerationRef.current !== generation) {
          return;
        }
        setSettledRunIds(prev => new Set([...prev, ...fresh]));
      };

      queryClient
        // Fail fast to un-enriched cards rather than shimmering through retries.
        .fetchQuery({...scmInfoQueryOptions(fresh), retry: false})
        .then(({json}) => {
          if (scopeGenerationRef.current !== generation) {
            return;
          }
          setScmByRunId(prev => {
            const next = new Map(prev);
            for (const id of fresh) {
              const entry = json.scmInfoByRunId?.[id];
              if (entry) {
                next.set(id, entry.pullRequests);
              }
            }
            return next;
          });
          settle();
        })
        .catch(settle);
    },
    [queryClient, scmInfoQueryOptions]
  );

  // A scope change (sort/project/date) remounts the cards; clear the SCM caches
  // so the reshown cards re-window instead of being deduped against the old scope.
  const scopeKey = JSON.stringify([selection.projects, selection.datetime, sort]);
  useEffect(() => {
    // Bump the generation so an in-flight window from the old scope is ignored
    // when it settles instead of writing stale data into the new scope.
    scopeGenerationRef.current += 1;
    requestedRunIdsRef.current.clear();
    setScmByRunId(new Map());
    setSettledRunIds(new Set());
  }, [scopeKey]);

  const isScmSettled = useCallback(
    (seerRunId: string) => settledRunIds.has(seerRunId),
    [settledRunIds]
  );

  const data = useMemo(
    () =>
      statusPollQuery.data ? mergeScmInfo(statusPollQuery.data, scmByRunId) : undefined,
    [statusPollQuery.data, scmByRunId]
  );

  return {
    data,
    projectConfig: projectConfigQuery.data?.projectConfig,
    projectConfigPending: projectConfigQuery.isLoading,
    isPending: !data,
    isError: statusPollQuery.isError && !data,
    // Poll-based: true once the sole source has painted, so milestone toasts
    // baseline off a real payload.
    dataSettled: !statusPollQuery.isPending && Boolean(statusPollQuery.data),
    requestScmWindow,
    isScmSettled,
    refetch: () => {
      statusPollQuery.refetch();
      projectConfigQuery.refetch();
    },
  };
}
