import {useMemo} from 'react';
import {SESSION_ID} from '@sentry/conventions/attributes';
import {skipToken, useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';

const REFERRER = 'api.explore.user-session-vitals';

/**
 * The vitals this reads, in the order they are shown. Same order the trace view
 * uses, so the two pill rows read alike.
 */
export const SESSION_WEB_VITALS: WebVitals[] = ['lcp', 'fcp', 'inp', 'cls', 'ttfb'];

/** The raw measurement backing each score, as EAP names it. */
const VITAL_VALUE_FIELD: Record<WebVitals, string> = {
  lcp: 'browser.web_vital.lcp.value',
  fcp: 'browser.web_vital.fcp.value',
  inp: 'browser.web_vital.inp.value',
  cls: 'browser.web_vital.cls.value',
  ttfb: 'browser.web_vital.ttfb.value',
};

interface EventsResponse {
  data: Array<Record<string, unknown>>;
}

export interface SessionVital {
  /**
   * How many of the session's spans reported this vital. Zero means the session
   * never measured it, which is a different statement from measuring it badly
   * and is rendered differently.
   */
  count: number;
  key: WebVitals;
  /** The session's score for this vital, 0-100. Undefined when `count` is zero. */
  score: number | undefined;
  /**
   * Mean measurement in the vital's own unit: milliseconds for everything but
   * CLS, which is unitless. Undefined when the vital was never measured.
   */
  value: number | undefined;
}

export interface SessionVitals {
  /**
   * What share of a full performance score the total actually covers, 0-100.
   * Anything under 100 means the total was renormalised over the vitals that
   * were present, and LCP and INP are 60 of it between them: the difference
   * between a performance score and three fifths of one.
   */
  coverage: number;
  isError: boolean;
  isPending: boolean;
  /** The vitals the session did measure, which is what `coverage` is the weight of. */
  measured: WebVitals[];
  /**
   * The session's overall performance score, 0-100, or undefined when it
   * reported no vitals at all. This is the weighted total Sentry computes
   * elsewhere, not a mean of the numbers in `vitals`.
   */
  totalScore: number | undefined;
  /** Every vital, in {@link SESSION_WEB_VITALS} order, measured or not. */
  vitals: SessionVital[];
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * The session's web vitals, averaged across every pageload and interaction it
 * made.
 *
 * Averaged with `performance_score()`, which is the same aggregate the Web
 * Vitals module and the project score are built on, so a session's 84 means what
 * an 84 means everywhere else. Per vital it is the mean of each span's stored
 * `score.ratio.<vital>`; the total is those means recombined under the standard
 * Web Vitals weights, counting only the vitals the session actually reported. A
 * session that never fired an interaction is therefore scored out of the four
 * vitals it does have rather than penalised for the missing INP.
 *
 * Deliberately *not* narrowed by `span.op` the way the Web Vitals module's
 * queries are. Those run over a whole project and use the op filter to keep the
 * scan down; this one is already pinned to a single session, and every aggregate
 * here only sees spans that carry the attribute in the first place. A span with
 * no LCP is not in the LCP average, so an op filter could only lose rows, never
 * change a number.
 *
 * A query of its own rather than a field on the count queries in
 * `useSessionDetail`: most sessions have no web vitals (anything that is not a
 * browser), and this must not hold up the timeline for them.
 */
export function useSessionVitals(sessionId: string): SessionVitals {
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
        dataset: 'spans',
        query: `${SESSION_ID}:${sessionId}`,
        field: [
          'performance_score(measurements.score.total)',
          ...SESSION_WEB_VITALS.flatMap(vital => [
            `performance_score(measurements.score.${vital})`,
            // The discriminator between "scored 0" and "never measured". A
            // session that never fired an interaction has no INP, and rendering
            // that as a red 0 would accuse it of something it didn't do.
            `count_scores(measurements.score.${vital})`,
            `avg(${VITAL_VALUE_FIELD[vital]})`,
          ]),
        ],
        per_page: 1,
      },
      staleTime: 0,
    })
  );

  return useMemo(() => {
    // An aggregate with no group-by returns a single row; no rows means the
    // session has nothing in the spans dataset at all.
    const row = data?.data[0];

    // Every vital, not just the ones with data. A vital the session never
    // measured comes back with a zero count and no score, so the row can say so
    // rather than leaving a gap: an omitted pill is indistinguishable from a
    // broken query, which is exactly how the first cut of this got read.
    const vitals = SESSION_WEB_VITALS.map<SessionVital>(key => {
      const count = toNumber(row?.[`count_scores(measurements.score.${key})`]) ?? 0;
      const score = toNumber(row?.[`performance_score(measurements.score.${key})`]);
      return {
        key,
        count,
        // Stored as a 0-1 ratio; every consumer in the app shows it out of 100.
        score: count === 0 || score === undefined ? undefined : Math.round(score * 100),
        value:
          count === 0 ? undefined : toNumber(row?.[`avg(${VITAL_VALUE_FIELD[key]})`]),
      };
    });

    const measured = vitals
      .filter(vital => vital.score !== undefined)
      .map(vital => vital.key);
    const total = toNumber(row?.['performance_score(measurements.score.total)']);

    return {
      vitals,
      measured,
      coverage: measured.reduce((sum, key) => sum + PERFORMANCE_SCORE_WEIGHTS[key], 0),
      // Gated on there being a vital to total: the endpoint answers 0 for a
      // session with no browser telemetry, and a "0" performance score is the
      // one number here that would be actively misread.
      totalScore:
        measured.length === 0 || total === undefined
          ? undefined
          : Math.round(total * 100),
      isPending,
      isError,
    };
  }, [data, isPending, isError]);
}
