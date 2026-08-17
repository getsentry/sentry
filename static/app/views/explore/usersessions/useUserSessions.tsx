import {useMemo} from 'react';
import {SESSION_ID} from '@sentry/conventions/attributes';
import {skipToken, useQueries} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {SessionDatasetKey} from './datasets';
import {SESSION_DATASETS} from './datasets';
import {SESSIONS_PER_PAGE} from './settings';

const REFERRER = 'api.explore.user-sessions';

interface EventsResponse {
  data: Array<Record<string, unknown>>;
}

export interface UserSession {
  counts: Record<SessionDatasetKey, number>;
  /** Epoch ms of the earliest event across all datasets, if any reported one. */
  firstSeen: number | undefined;
  id: string;
  /** Epoch ms of the latest event across all datasets, if any reported one. */
  lastSeen: number | undefined;
  totalEvents: number;
}

function toCount(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function minDefined(a: number | undefined, b: number | undefined) {
  if (a === undefined) {
    return b;
  }
  if (b === undefined) {
    return a;
  }
  return Math.min(a, b);
}

function maxDefined(a: number | undefined, b: number | undefined) {
  if (a === undefined) {
    return b;
  }
  if (b === undefined) {
    return a;
  }
  return Math.max(a, b);
}

/**
 * Lists distinct `session.id` values with a per-dataset event count.
 *
 * There is no endpoint that queries several datasets at once, so this runs in
 * two phases:
 *
 * 1. **Discovery** — one query per dataset, each grouped by `session.id` and
 *    ordered by that dataset's latest-event aggregate. The union of each
 *    dataset's top-N by recency provably contains the global top-N by recency,
 *    so slicing the union to N gives the exact set of most-recent sessions.
 * 2. **Counts** — one query per dataset again, this time filtered to
 *    `session.id:[...]` over exactly the sessions being rendered. Without this
 *    a session that missed one dataset's top-N would render a 0 count for that
 *    dataset even though events exist.
 */
export function useUserSessions() {
  const organization = useOrganization();
  const {selection, isReady: arePageFiltersReady} = usePageFilters();

  const commonQuery = useMemo(
    () => ({
      ...normalizeDateTimeParams(selection.datetime),
      project: selection.projects,
      environment: selection.environments,
      referrer: REFERRER,
      per_page: SESSIONS_PER_PAGE,
    }),
    [selection]
  );

  const discovery = useQueries({
    queries: SESSION_DATASETS.map(config =>
      apiOptions.as<EventsResponse>()('/organizations/$organizationIdOrSlug/events/', {
        path: arePageFiltersReady ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          ...commonQuery,
          dataset: config.dataset,
          field: [
            SESSION_ID,
            config.countField,
            config.firstSeenField,
            config.lastSeenField,
          ],
          query: `has:${SESSION_ID}`,
          sort: `-${config.lastSeenField}`,
        },
        staleTime: 0,
      })
    ),
    combine: results => ({
      results,
      isPending: results.some(result => result.isPending),
      isError: results.some(result => result.isError),
      error: results.find(result => result.error)?.error ?? null,
    }),
  });

  // Assemble the candidate set and pick the globally most-recent sessions.
  const sessionIds = useMemo(() => {
    if (discovery.isPending) {
      return [];
    }

    const lastSeenById = new Map<string, number | undefined>();

    discovery.results.forEach((result, index) => {
      const config = SESSION_DATASETS[index]!;
      result.data?.data.forEach(row => {
        const id = row[SESSION_ID];
        if (typeof id !== 'string' || !id) {
          return;
        }
        const lastSeen = config.toEpochMs(row[config.lastSeenField]);
        lastSeenById.set(id, maxDefined(lastSeenById.get(id), lastSeen));
      });
    });

    return Array.from(lastSeenById.entries())
      .sort(([idA, a], [idB, b]) => {
        // Sessions whose dataset did not report a usable timestamp sort last but
        // still need a stable order, hence the id tiebreak.
        if (a === b) {
          return idA.localeCompare(idB);
        }
        if (a === undefined) {
          return 1;
        }
        if (b === undefined) {
          return -1;
        }
        return b - a;
      })
      .slice(0, SESSIONS_PER_PAGE)
      .map(([id]) => id);
  }, [discovery.isPending, discovery.results]);

  const hasSessionIds = sessionIds.length > 0;

  const counts = useQueries({
    queries: SESSION_DATASETS.map(config =>
      apiOptions.as<EventsResponse>()('/organizations/$organizationIdOrSlug/events/', {
        path: hasSessionIds ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          ...commonQuery,
          dataset: config.dataset,
          field: [
            SESSION_ID,
            config.countField,
            config.firstSeenField,
            config.lastSeenField,
          ],
          query: `${SESSION_ID}:[${sessionIds.join(',')}]`,
          sort: `-${config.countField}`,
        },
        staleTime: 0,
      })
    ),
    combine: results => ({
      results,
      isPending: results.some(result => result.isPending),
      isError: results.some(result => result.isError),
      error: results.find(result => result.error)?.error ?? null,
    }),
  });

  const sessions = useMemo((): UserSession[] => {
    if (!hasSessionIds || counts.isPending) {
      return [];
    }

    const byId = new Map<string, UserSession>(
      sessionIds.map(id => [
        id,
        {
          id,
          counts: {logs: 0, metrics: 0, spans: 0, errors: 0},
          firstSeen: undefined,
          lastSeen: undefined,
          totalEvents: 0,
        },
      ])
    );

    counts.results.forEach((result, index) => {
      const config = SESSION_DATASETS[index]!;
      result.data?.data.forEach(row => {
        const id = row[SESSION_ID];
        if (typeof id !== 'string') {
          return;
        }
        const session = byId.get(id);
        if (!session) {
          return;
        }
        const count = toCount(row[config.countField]);
        session.counts[config.key] = count;
        session.totalEvents += count;
        session.firstSeen = minDefined(
          session.firstSeen,
          config.toEpochMs(row[config.firstSeenField])
        );
        session.lastSeen = maxDefined(
          session.lastSeen,
          config.toEpochMs(row[config.lastSeenField])
        );
      });
    });

    // Preserve the recency order established during discovery.
    return sessionIds.map(id => byId.get(id)!);
  }, [counts.isPending, counts.results, hasSessionIds, sessionIds]);

  return {
    sessions,
    isPending: discovery.isPending || (hasSessionIds && counts.isPending),
    isError: discovery.isError || counts.isError,
    error: discovery.error ?? counts.error,
  };
}
