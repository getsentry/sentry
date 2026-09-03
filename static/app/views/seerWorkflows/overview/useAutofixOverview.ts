import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilterDatetime, PageFilters} from 'sentry/types/core';
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

export function runsMissingStats(
  poll: AutofixOverviewResponse | undefined,
  statsByRunId: ReadonlyMap<string, unknown>
): string[] {
  if (!poll) {
    return [];
  }
  const missing: string[] = [];
  for (const runs of Object.values(poll.runsByMilestone)) {
    for (const run of runs) {
      if (!statsByRunId.has(run.seerRunId)) {
        missing.push(run.seerRunId);
      }
    }
  }
  return missing;
}

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

type IssueStats = {
  count: string | null;
  lastSeen: string | null;
  userCount: number | null;
};

function overlayIssueStats(
  base: AutofixOverviewResponse,
  statsByRunId: Map<string, IssueStats>
): AutofixOverviewResponse {
  if (statsByRunId.size === 0) {
    return base;
  }
  const runsByMilestone = Object.fromEntries(
    Object.entries(base.runsByMilestone).map(([milestone, runs]) => [
      milestone,
      runs.map(run => {
        const stats = statsByRunId.get(run.seerRunId);
        return stats ? {...run, issue: {...run.issue, ...stats}} : run;
      }),
    ])
  ) as AutofixOverviewResponse['runsByMilestone'];
  return {...base, runsByMilestone};
}

// Progressive load: the 10s status poll paints cards fast; slower Snuba vitals
// and GitHub SCM detail fill in afterward without blocking the poll.
export function useAutofixOverview({
  organization,
  selection,
  datetime,
  sort,
  enabled,
}: {
  datetime: PageFilterDatetime;
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
          ...normalizeDateTimeParams(datetime),
          // 'seer' is the backend's default order, so it needs no sort param.
          ...(sort === 'seer' ? {} : {sort}),
          ...query,
        },
        staleTime: QUERY_STALE_TIME,
      }
    );

  const statusPollQuery = useQuery({
    ...overviewQuery({expand: ['status']}),
    enabled,
    refetchInterval: POLL_INTERVAL,
  });

  const issueStatsQuery = useQuery({
    ...overviewQuery({expand: ['issueStats']}),
    enabled,
    retry: 1,
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

  const requestedRunIdsRef = useRef<Set<string>>(new Set());
  const [settledRunIds, setSettledRunIds] = useState<Set<string>>(() => new Set());
  const [scmByRunId, setScmByRunId] = useState<Map<string, OverviewPullRequest[]>>(
    () => new Map()
  );
  const scopeGenerationRef = useRef(0);
  // Ids we've already refetched issueStats for, so a run persistently missing
  // from the stats response can't loop the Snuba call every poll.
  const refetchedRunIdsRef = useRef<Set<string>>(new Set());
  // Runs still absent from issueStats after their one refetch settled; drop their
  // vitals shimmer so a deleted/inaccessible issue's card doesn't shimmer forever.
  const [statsUnavailableRunIds, setStatsUnavailableRunIds] = useState<Set<string>>(
    () => new Set()
  );

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
  const scopeKey = JSON.stringify([selection.projects, datetime, sort]);
  useEffect(() => {
    scopeGenerationRef.current += 1;
    requestedRunIdsRef.current.clear();
    refetchedRunIdsRef.current.clear();
    setScmByRunId(new Map());
    setSettledRunIds(new Set());
    setStatsUnavailableRunIds(new Set());
  }, [scopeKey]);

  const isScmSettled = useCallback(
    (seerRunId: string) => settledRunIds.has(seerRunId),
    [settledRunIds]
  );

  const issueStatsByRunId = useMemo(() => {
    const map = new Map<string, IssueStats>();
    for (const runs of Object.values(issueStatsQuery.data?.runsByMilestone ?? {})) {
      for (const run of runs) {
        map.set(run.seerRunId, {
          count: run.issue.count,
          lastSeen: run.issue.lastSeen,
          userCount: run.issue.userCount,
        });
      }
    }
    return map;
  }, [issueStatsQuery.data]);

  const issueStatsRefetch = issueStatsQuery.refetch;
  const issueStatsFetching = issueStatsQuery.isFetching;
  const hasIssueStats = Boolean(issueStatsQuery.data);
  useEffect(() => {
    if (!hasIssueStats || issueStatsFetching) {
      return;
    }
    const missing = runsMissingStats(statusPollQuery.data, issueStatsByRunId);
    // A run still missing after its one refetch settled won't self-heal; mark it
    // so its vitals stop shimmering instead of hanging on forever.
    const exhausted = missing.filter(id => refetchedRunIdsRef.current.has(id));
    if (exhausted.length > 0) {
      setStatsUnavailableRunIds(prev =>
        exhausted.every(id => prev.has(id)) ? prev : new Set([...prev, ...exhausted])
      );
    }
    const fresh = missing.filter(id => !refetchedRunIdsRef.current.has(id));
    if (fresh.length === 0) {
      return;
    }
    for (const id of fresh) {
      refetchedRunIdsRef.current.add(id);
    }
    issueStatsRefetch();
  }, [
    statusPollQuery.data,
    issueStatsByRunId,
    hasIssueStats,
    issueStatsFetching,
    issueStatsRefetch,
  ]);

  const isVitalsPending = useCallback(
    (seerRunId: string) =>
      !issueStatsByRunId.has(seerRunId) &&
      !issueStatsQuery.isError &&
      !statsUnavailableRunIds.has(seerRunId),
    [issueStatsByRunId, issueStatsQuery.isError, statsUnavailableRunIds]
  );

  const data = useMemo(
    () =>
      statusPollQuery.data
        ? mergeScmInfo(
            overlayIssueStats(statusPollQuery.data, issueStatsByRunId),
            scmByRunId
          )
        : undefined,
    [statusPollQuery.data, issueStatsByRunId, scmByRunId]
  );

  return {
    data,
    projectConfig: projectConfigQuery.data?.projectConfig,
    projectConfigPending: projectConfigQuery.isLoading,
    issueStatsPending: issueStatsQuery.isLoading,
    isPending: !data,
    isError: statusPollQuery.isError && !data,
    // isFetching, not isPending: a stale-cache remount must wait for the refetch
    // so milestone toasts baseline off fresh data, not the stale snapshot.
    dataSettled: !statusPollQuery.isFetching && Boolean(statusPollQuery.data),
    requestScmWindow,
    isScmSettled,
    isVitalsPending,
    refetch: () => {
      statusPollQuery.refetch();
      issueStatsQuery.refetch();
      projectConfigQuery.refetch();
    },
  };
}
