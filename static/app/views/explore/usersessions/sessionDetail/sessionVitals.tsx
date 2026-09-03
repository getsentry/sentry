import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';

import {t, tn} from 'sentry/locale';
import {VITAL_DESCRIPTIONS} from 'sentry/views/insights/browser/webVitals/components/webVitalDescription';
import {WEB_VITALS_METERS_CONFIG} from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import {
  scoreToStatus,
  STATUS_TEXT,
} from 'sentry/views/insights/browser/webVitals/utils/scoreToStatus';

import type {PillTone} from './metricPill';
import {MetricPill} from './metricPill';
import type {SessionVital, SessionVitals} from './useSessionVitals';

/**
 * A score's status in the pill vocabulary. Only the middle tier is renamed:
 * "needs improvement" is a web vitals idea, and the pill beside this one reports
 * session health, where the same colour means "errored".
 */
function scoreTone(score: number | undefined): PillTone {
  if (score === undefined) {
    return 'none';
  }
  const status = scoreToStatus(score);
  return status === 'needsImprovement' ? 'warning' : status;
}

const VITAL_ACRONYM = {
  lcp: t('LCP'),
  fcp: t('FCP'),
  inp: t('INP'),
  cls: t('CLS'),
  ttfb: t('TTFB'),
};

/** The dash means "no reading", not "a reading of zero". */
const NO_VALUE = '\u2014';

function formatValue(vital: SessionVital): string {
  if (vital.value === undefined) {
    return NO_VALUE;
  }
  return String(WEB_VITALS_METERS_CONFIG[vital.key].formatter(vital.value));
}

/** What a vital is, then what this session did about it. */
function vitalTooltip(vital: SessionVital) {
  return (
    <Fragment>
      <div>{VITAL_DESCRIPTIONS[`measurements.${vital.key}`]?.shortDescription}</div>
      <Separator orientation="horizontal" border="primary" />
      {vital.score === undefined ? (
        // Said outright, because the alternative reading is that we measured it
        // and it was terrible. A session only reports INP once the user has
        // interacted, and LCP once the page has been backgrounded or clicked, so
        // a live or passive session legitimately has neither.
        <div>{t('Not reported by this session.')}</div>
      ) : (
        <Fragment>
          <div>{t('Average: %s', formatValue(vital))}</div>
          <div>
            {t('Score: %s (%s)', vital.score, STATUS_TEXT[scoreToStatus(vital.score)])}
          </div>
          <div>
            {tn(
              'Averaged over %s measurement in this session.',
              'Averaged over %s measurements in this session.',
              vital.count
            )}
          </div>
        </Fragment>
      )}
    </Fragment>
  );
}

/**
 * What the session's own score is worth, given what it managed to measure.
 *
 * The total is renormalised over the vitals that are present, so a session with
 * only FCP, CLS and TTFB still scores out of 100 while covering 40% of a real
 * performance score. LCP and INP are 30 points each, so the two vitals most
 * likely to be missing are also the two that matter most: saying the number
 * without saying its coverage would overstate it every time.
 */
function scoreTooltip(coverage: number, measured: string[]) {
  return (
    <Fragment>
      <div>
        {t(
          "This session's performance score: the weighted average of the web vitals it reported, on the same scale used across Insights."
        )}
      </div>
      {coverage < 100 && (
        <Fragment>
          <Separator orientation="horizontal" border="primary" />
          <div>
            {t(
              'Based on %s only, which is %s of the 100 points a full score is out of. The rest were not reported.',
              measured.join(', '),
              coverage
            )}
          </div>
        </Fragment>
      )}
    </Fragment>
  );
}

/**
 * The session's web vitals, averaged over everything it loaded.
 *
 * All five are always drawn, including the ones with no reading, which show a
 * muted dash. Omitting them was the first cut and it was wrong: a pill that is
 * simply absent is indistinguishable from a query that failed, and LCP and INP
 * are missing often enough that the gap reads as a bug every time.
 *
 * The row as a whole still disappears for a session that reported no vitals at
 * all, which is most of them. Anything that is not a browser has nothing to
 * average, and five dashes there would claim we looked. Nothing is
 * rendered while the query is in flight either: this sits beside the session's
 * name rather than above the timeline, so it can appear without pushing anything
 * down, and reserving space for a row that usually never arrives would leave a
 * hole on every non-browser session.
 */
export function SessionVitalsRow({
  vitals,
  totalScore,
  coverage,
  measured,
}: SessionVitals) {
  if (totalScore === undefined || measured.length === 0) {
    return null;
  }

  return (
    // Wrapping rather than collapsing into a "+N more" the way the trace view's
    // vitals row does: this one sits next to a session name that already
    // truncates, so there is a flexible neighbour to take the pressure, and five
    // pills that occasionally use two lines beat five that are usually hidden.
    <Flex align="center" gap="md" wrap="wrap" justify="end">
      <MetricPill
        isLead
        name={t('Score')}
        value={String(totalScore)}
        tone={scoreTone(totalScore)}
        tooltip={scoreTooltip(
          coverage,
          measured.map(key => VITAL_ACRONYM[key])
        )}
      />
      {vitals.map(vital => (
        <MetricPill
          key={vital.key}
          name={VITAL_ACRONYM[vital.key]}
          value={formatValue(vital)}
          // `none` is the muted grey kept for exactly this: a vital with no
          // reading is not a bad vital, so it must not borrow the red that means
          // one.
          tone={scoreTone(vital.score)}
          tooltip={vitalTooltip(vital)}
        />
      ))}
    </Flex>
  );
}
