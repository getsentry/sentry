import {useEffect, useMemo} from 'react';
import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {
  type AutofixOverviewResponse,
  type MilestoneKey,
  type OverviewRun,
  OVERVIEW_SECTIONS,
  type OverviewSort,
  PIPELINE,
  POLL_INTERVAL,
  QUERY_STALE_TIME,
  type RunStatus,
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

function statusByRunId(
  data: AutofixOverviewResponse | undefined
): Map<string, RunStatus | null> {
  const map = new Map<string, RunStatus | null>();
  for (const runs of Object.values(data?.runsByMilestone ?? {})) {
    for (const run of runs) {
      map.set(run.seerRunId, run.status);
    }
  }
  return map;
}

// Fingerprint of which run sits in which section; a change cues an enrichment refetch.
export function sectionSignature(
  data: AutofixOverviewResponse | undefined
): string | null {
  if (!data) {
    return null;
  }
  const pairs: string[] = [];
  for (const [milestone, runs] of Object.entries(data.runsByMilestone)) {
    for (const run of runs) {
      pairs.push(`${run.seerRunId}:${milestone}`);
    }
  }
  return pairs.sort().join(',');
}

export function shouldRefetchEnriched(
  pollData: AutofixOverviewResponse | undefined,
  enrichedData: AutofixOverviewResponse | undefined
): boolean {
  const pollSignature = sectionSignature(pollData);
  const enrichedSignature = sectionSignature(enrichedData);
  return (
    pollSignature !== null &&
    enrichedSignature !== null &&
    pollSignature !== enrichedSignature
  );
}

export function overlayStatus(
  base: AutofixOverviewResponse,
  poll: AutofixOverviewResponse | undefined
): AutofixOverviewResponse {
  const statuses = statusByRunId(poll);
  if (statuses.size === 0) {
    return base;
  }
  let changed = false;
  const runsByMilestone = Object.fromEntries(
    Object.entries(base.runsByMilestone).map(([milestone, runs]) => [
      milestone,
      runs.map(run => {
        const next = statuses.get(run.seerRunId);
        if (typeof next === 'string' && next !== run.status) {
          changed = true;
          return {...run, status: next};
        }
        return run;
      }),
    ])
  ) as AutofixOverviewResponse['runsByMilestone'];
  return changed ? {...base, runsByMilestone} : base;
}

// Progressive load: a light `status` poll paints cards fast and stays live every 10s;
// the enriched `expand` request fills in Snuba/SCM detail and refetches on section change.
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
  const overviewQuery = (query: {expand?: Array<'scmInfo' | 'issueStats' | 'status'>}) =>
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

  const enrichedQuery = useQuery({
    ...overviewQuery({expand: ['scmInfo', 'issueStats', 'status']}),
    enabled,
    placeholderData: keepPreviousData,
    // Enrichment is progressive polish: fail fast to empty slots rather than
    // shimmering through the default retry backoff.
    retry: 1,
  });

  const statusPollQuery = useQuery({
    ...overviewQuery({expand: ['status']}),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: POLL_INTERVAL,
  });

  const enrichedRefetch = enrichedQuery.refetch;
  useEffect(() => {
    if (shouldRefetchEnriched(statusPollQuery.data, enrichedQuery.data)) {
      enrichedRefetch();
    }
  }, [statusPollQuery.data, enrichedQuery.data, enrichedRefetch]);

  const source = enrichedQuery.data ?? statusPollQuery.data;
  const data = useMemo(
    () => (source ? overlayStatus(source, statusPollQuery.data) : undefined),
    [source, statusPollQuery.data]
  );

  return {
    data,
    isPending: !data,
    // Error only once both fail with nothing to show; the poll alone may still be
    // recovered by an in-flight enriched call.
    isError: statusPollQuery.isError && enrichedQuery.isError && !data,
    // Cold-load shimmer only: the poll painted but no enriched payload yet.
    enrichmentPending: Boolean(data) && !enrichedQuery.data && !enrichedQuery.isError,
    // A later refetch keeps the list up; the caller shows a spinner meanwhile.
    isRefetching: enrichedQuery.isFetching && Boolean(enrichedQuery.data),
    enrichedSettled: !enrichedQuery.isFetching && Boolean(enrichedQuery.data),
    refetch: () => {
      statusPollQuery.refetch();
      enrichedQuery.refetch();
    },
  };
}
