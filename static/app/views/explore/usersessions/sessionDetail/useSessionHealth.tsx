import {useMemo} from 'react';
import {SESSION_ID} from '@sentry/conventions/attributes';
import {skipToken, useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

const REFERRER = 'api.explore.user-session-health';

/**
 * How the session went, in the vocabulary Sentry already uses for this.
 *
 * These are three of the statuses release health reports (`SessionStatus` in
 * `sentry/types/organization`), and they are derived to mean the same things, so
 * a session marked `crashed` here is one that counted against its release's
 * crash-free rate.
 *
 * `abnormal` is deliberately absent. It means the session ended without a proper
 * exit, and telemetry carries no session-end event, so there is nothing to read
 * it from — an `abnormal` here would be invented rather than derived.
 */
export type SessionHealthStatus = 'crashed' | 'errored' | 'healthy';

interface EventsResponse {
  data: Array<Record<string, unknown>>;
}

export interface SessionHealth {
  /**
   * Unhandled errors in the session. The count, not just the fact, because one
   * unhandled error and forty are different sessions.
   */
  crashCount: number;
  /** Every error event in the session, unhandled ones included. */
  errorCount: number;
  isError: boolean;
  isPending: boolean;
  /** Undefined until both halves have landed. */
  status: SessionHealthStatus | undefined;
}

/**
 * Whether the session crashed, errored, or came through clean.
 *
 * Derived rather than read, because the authoritative answer is not reachable:
 * release health stores `session.status` as a *virtual* tag exploded from
 * per-project/release/hour counters (`sessions_crashed`, `sessions_errored`, …),
 * so there are no per-session rows to look up, and its dataset is not one the
 * events endpoint serves. Deriving it is therefore the only option, which is why
 * it is derived to release health's own definition instead of a new one:
 *
 * - **crashed** — at least one unhandled error.
 * - **errored** — errors, but the session survived all of them.
 * - **healthy** — no errors at all.
 *
 * `errorCount` is passed in rather than queried, since the detail page's count
 * pass already has it. This adds one aggregate for the unhandled half.
 *
 * That half is a filtered `count()` rather than a `count_if` folded into the
 * count query, which would have cost no request at all. `error.unhandled` is an
 * alias the errors dataset resolves to an expression rather than a plain column,
 * and `count_if` casts its comparison value by column type — so the free version
 * is the one that is not obviously correct, and this is the path the dataset
 * documents (`_error_unhandled_filter_converter`).
 */
export function useSessionHealth({
  sessionId,
  errorCount,
}: {
  /** Total errors from the count pass, or undefined while it is still in flight. */
  errorCount: number | undefined;
  sessionId: string;
}): SessionHealth {
  const organization = useOrganization();
  const {selection, isReady: arePageFiltersReady} = usePageFilters();

  const enabled = arePageFiltersReady && Boolean(sessionId);

  const {data, isPending, isError} = useQuery(
    apiOptions.as<EventsResponse>()('/organizations/$organizationIdOrSlug/events/', {
      path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        ...normalizeDateTimeParams(selection.datetime),
        project: selection.projects,
        environment: selection.environments,
        referrer: REFERRER,
        dataset: 'errors',
        query: `${SESSION_ID}:${sessionId} error.unhandled:true`,
        field: ['count()'],
        per_page: 1,
      },
      staleTime: 0,
    })
  );

  return useMemo(() => {
    // An aggregate with no group-by returns a single row; no rows means zero.
    const row = data?.data[0];
    const raw = row?.['count()'];
    const crashCount = typeof raw === 'number' ? raw : 0;

    return {
      crashCount,
      errorCount: errorCount ?? 0,
      // Withheld until the totals are in. A session mid-load has no status, and
      // "healthy" is exactly the wrong thing to say while still counting: the
      // pill would flash green and then turn red.
      status:
        isPending || isError || errorCount === undefined
          ? undefined
          : crashCount > 0
            ? 'crashed'
            : errorCount > 0
              ? 'errored'
              : 'healthy',
      isPending,
      isError,
    };
  }, [data, errorCount, isPending, isError]);
}
