import {Fragment} from 'react';

import {InfoText} from '@sentry/scraps/info';
import {Separator} from '@sentry/scraps/separator';

import {t, tn} from 'sentry/locale';

import type {SessionHealth, SessionHealthStatus} from './useSessionHealth';

const STATUS_LABEL: Record<SessionHealthStatus, string> = {
  crashed: t('Crashed'),
  errored: t('Errored'),
  healthy: t('Healthy'),
};

// Narrower than `ContentVariant`: `InfoText` tints its dotted underline from the
// same value, and only these carry one.
const STATUS_VARIANT: Record<SessionHealthStatus, 'danger' | 'warning' | 'success'> = {
  crashed: 'danger',
  errored: 'warning',
  healthy: 'success',
};

/** What the verdict means, and the counts it was reached from. */
function healthTooltip({status, crashCount, errorCount}: SessionHealth) {
  if (status === undefined) {
    return null;
  }

  return (
    <Fragment>
      <div>
        {status === 'crashed'
          ? t(
              'This session hit an unhandled error. That is the same thing release health counts as a crash, so this session counted against its crash-free rate.'
            )
          : status === 'errored'
            ? t('This session reported errors but handled all of them.')
            : t('This session reported no errors.')}
      </div>
      {errorCount > 0 && (
        <Fragment>
          <Separator orientation="horizontal" border="primary" />
          <div>
            {tn('%s error in total.', '%s errors in total.', errorCount)}
            {crashCount > 0
              ? ` ${tn('%s unhandled.', '%s unhandled.', crashCount)}`
              : ` ${t('None unhandled.')}`}
          </div>
        </Fragment>
      )}
    </Fragment>
  );
}

/**
 * How the session went: crashed, errored, or clean.
 *
 * A word on the badge's secondary line rather than a pill of its own. It was a
 * pill first, sized like the vitals beside it, and that was too much furniture for
 * one adjective — a chip claims the weight of a measurement, and this is a verdict
 * that fits in a word. On that line it reads as part of what the session *is*,
 * alongside the browser and the release, which is where it belongs.
 *
 * Still coloured, though: the whole point is that a crashed session is findable
 * without reading. The counts stay in the tooltip, which is what the dotted
 * underline advertises.
 *
 * Renders nothing until the verdict is in. Unlike the vitals row this one resolves
 * for every session, so it will always arrive; what it must not do is say
 * "Healthy" while errors are still being counted.
 */
export function SessionHealthText(health: SessionHealth) {
  if (health.status === undefined) {
    return null;
  }

  return (
    <InfoText
      size="sm"
      variant={STATUS_VARIANT[health.status]}
      title={healthTooltip(health)}
    >
      {STATUS_LABEL[health.status]}
    </InfoText>
  );
}
