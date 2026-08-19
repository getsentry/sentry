import {useMemo} from 'react';
import {SESSION_ID} from '@sentry/conventions/attributes';
import {skipToken, useQueries} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {SessionDatasetKey} from './datasets';
import {SESSION_DATASETS, withBaseFilter} from './datasets';
import type {KnownKeysByDataset} from './queryRouting';
import {datasetsForQuery} from './queryRouting';
import type {SessionIdentity, SessionName} from './sessionName';
import {
  identityFields,
  mergeIdentities,
  readIdentity,
  resolveSessionName,
} from './sessionName';
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
  /** What to call this session, resolved from the telemetry it carries. */
  name: SessionName;
  totalEvents: number;
}

/** A session mid-merge, still collecting the attributes its name comes from. */
interface SessionAccumulator extends Omit<UserSession, 'name'> {
  identity: SessionIdentity;
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

/** Rows without a usable timestamp sort last in either direction. */
function byLastSeenDesc(
  [idA, a]: [string, number | undefined],
  [idB, b]: [string, number | undefined]
) {
  if (a === b) {
    // Sessions whose dataset did not report a usable timestamp still need a
    // stable order, hence the id tiebreak.
    return idA.localeCompare(idB);
  }
  if (a === undefined) {
    return 1;
  }
  if (b === undefined) {
    return -1;
  }
  return b - a;
}

interface UseUserSessionsOptions {
  /**
   * Per-dataset searchable keys, used to route `query` to the datasets that can
   * answer it. Required whenever `query` is set.
   */
  knownKeys?: KnownKeysByDataset;
  /**
   * True while `knownKeys` is still loading. Discovery waits for it rather than
   * routing a query against an incomplete key set.
   */
  knownKeysLoading?: boolean;
  /** Search query, applied to individual telemetry items. */
  query?: string;
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
 *
 * `query` narrows discovery only. A session is listed when at least one of its
 * telemetry items matches, and it is then reported with its full event counts —
 * the filter selects sessions, it does not redefine what a session contains.
 * Only the datasets that know every key in the query are asked (see
 * `datasetsForQuery`), so no dataset is sent a filter it would reject.
 */
export function useUserSessions({
  query = '',
  knownKeys,
  knownKeysLoading = false,
}: UseUserSessionsOptions = {}) {
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

  const hasQuery = Boolean(query.trim());

  // Parenthesized so a top-level OR in the user's query keeps its precedence
  // against the `has:session.id` we AND on.
  const discoveryQuery = hasQuery
    ? `has:${SESSION_ID} (${query.trim()})`
    : `has:${SESSION_ID}`;

  const routedDatasets = useMemo(() => {
    if (!hasQuery) {
      return new Set(SESSION_DATASETS.map(config => config.key));
    }
    if (!knownKeys || knownKeysLoading) {
      return new Set<SessionDatasetKey>();
    }
    return new Set(datasetsForQuery(query, knownKeys));
  }, [hasQuery, knownKeys, knownKeysLoading, query]);

  const isDiscoveryReady = arePageFiltersReady && !(hasQuery && knownKeysLoading);

  const discovery = useQueries({
    queries: SESSION_DATASETS.map(config =>
      apiOptions.as<EventsResponse>()('/organizations/$organizationIdOrSlug/events/', {
        path:
          isDiscoveryReady && routedDatasets.has(config.key)
            ? {organizationIdOrSlug: organization.slug}
            : skipToken,
        query: {
          ...commonQuery,
          dataset: config.dataset,
          field: [
            SESSION_ID,
            config.countField,
            config.firstSeenField,
            config.lastSeenField,
          ],
          query: withBaseFilter(config, discoveryQuery),
          sort: `-${config.lastSeenField}`,
        },
        staleTime: 0,
      })
    ),
    // Skipped datasets stay `pending` forever, so every aggregate below has to
    // ignore them or the page would never stop loading.
    combine: results => {
      const routed = results.filter((_, index) =>
        routedDatasets.has(SESSION_DATASETS[index]!.key)
      );
      return {
        results,
        isPending: routed.some(result => result.isPending),
        // One dataset rejecting the query degrades to "no matches from that
        // dataset"; only a total failure is an error.
        isError: routed.length > 0 && routed.every(result => result.isError),
        error: routed.find(result => result.error)?.error ?? null,
      };
    },
  });

  // Assemble the candidate set and pick the globally most-recent sessions.
  const sessionIds = useMemo(() => {
    if (discovery.isPending || !isDiscoveryReady) {
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
      .sort(byLastSeenDesc)
      .slice(0, SESSIONS_PER_PAGE)
      .map(([id]) => id);
  }, [discovery.isPending, discovery.results, isDiscoveryReady]);

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
            // Same grouping, so naming costs extra columns rather than an extra
            // query. Discovery deliberately does not ask for these: it runs
            // under the user's filter, and a name has to describe the whole
            // session rather than the part that matched.
            ...identityFields(config.key),
          ],
          query: withBaseFilter(config, `${SESSION_ID}:[${sessionIds.join(',')}]`),
          sort: `-${config.countField}`,
        },
        staleTime: 0,
      })
    ),
    combine: results => ({
      results,
      isPending: results.some(result => result.isPending),
      // Feedback rides on issuePlatform and is best-effort — see the discovery
      // combine above.
      isError: results.some(
        (result, index) =>
          SESSION_DATASETS[index]!.key !== 'feedback' && result.isError
      ),
      error: results.find(result => result.error)?.error ?? null,
    }),
  });

  const sessions = useMemo((): UserSession[] => {
    if (!hasSessionIds || counts.isPending) {
      return [];
    }

    const byId = new Map<string, SessionAccumulator>(
      sessionIds.map(id => [
        id,
        {
          id,
          counts: {logs: 0, metrics: 0, traces: 0, errors: 0, feedback: 0},
          firstSeen: undefined,
          lastSeen: undefined,
          totalEvents: 0,
          identity: {},
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
        // Datasets are visited in `SESSION_DATASETS` order, so an attribute
        // present in more than one is taken from the earlier one.
        session.identity = mergeIdentities([
          session.identity,
          readIdentity(config.key, row),
        ]);
      });
    });

    // Order by the unfiltered `lastSeen` the row actually displays. Discovery
    // ordered by *filtered* recency, which under a query is a different number.
    return Array.from(byId.values())
      .map(({identity, ...session}) => ({
        ...session,
        name: resolveSessionName(session.id, identity),
      }))
      .sort((a, b) => byLastSeenDesc([a.id, a.lastSeen], [b.id, b.lastSeen]));
  }, [counts.isPending, counts.results, hasSessionIds, sessionIds]);

  return {
    sessions,
    isPending:
      // Without this, a page load with `?query=` in the URL flashes the empty
      // state before the key sets arrive and routing can run.
      !isDiscoveryReady || discovery.isPending || (hasSessionIds && counts.isPending),
    isError: discovery.isError || counts.isError,
    error: discovery.error ?? counts.error,
  };
}
