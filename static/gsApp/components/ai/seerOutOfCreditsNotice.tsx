import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import type {
  SeerOutOfCreditsCtaProps,
  SeerOutOfCreditsReason,
} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {t} from 'sentry/locale';

/**
 * What the viewer can do about running out of credits:
 *
 * - `configure`: billing members configure auto reload themselves.
 * - `request`: everyone else asks the billing members to add credits.
 * - `contact`: orgs that can't self-serve buy credits through their account
 *   team, so members get no button and are only told who to ask.
 */
export type SeerOutOfCreditsEscalation = 'configure' | 'request' | 'contact';

// Billing members, from the "Seer Billing Gates Copy" spec. Auto reload already
// on means the org ran through the top-ups it allows, so the copy says so.
const BILLING_MESSAGE: Record<SeerOutOfCreditsReason, Record<'off' | 'on', string>> = {
  'agent-chat': {
    off: t(
      'Your organization does not have enough credits left for you to message Seer. Adjust your spend and turn on auto reload.'
    ),
    on: t(
      'Your organization does not have enough credits left for you to message Seer, and you have no auto top-ups remaining. Adjust your spend and turn on auto top-up.'
    ),
  },
  'autofix-start': {
    off: t(
      'You do not have enough credits to start an Autofix run. Set up auto top up to keep your flow uninterrupted.'
    ),
    on: t(
      'You do not have enough credits to start an Autofix run, and you have no auto top-ups remaining. Adjust your spend and turn on auto top-up.'
    ),
  },
  'autofix-continue': {
    off: t(
      'Your org does not have enough credits to continue your Autofix run. Set up auto top up to keep your flow uninterrupted.'
    ),
    on: t(
      'Your org does not have enough credits to continue your Autofix run, and you have no auto top-ups remaining. Adjust your spend and turn on auto top-up.'
    ),
  },
};

// The spec has no member copy yet, so members get the role-neutral first
// sentence plus who to ask.
const MEMBER_LEAD: Record<SeerOutOfCreditsReason, string> = {
  'agent-chat': t(
    'Your organization does not have enough credits left for you to message Seer.'
  ),
  'autofix-start': t('You do not have enough credits to start an Autofix run.'),
  'autofix-continue': t(
    'Your org does not have enough credits to continue your Autofix run.'
  ),
};

const MEMBER_ASK: Record<Exclude<SeerOutOfCreditsEscalation, 'configure'>, string> = {
  request: t('Ask someone with billing access to add more.'),
  contact: t('Ask someone with billing access in your organization to add more.'),
};

function getSeerOutOfCreditsMessage({
  reason,
  escalation,
  autoReloadEnabled,
}: {
  escalation: SeerOutOfCreditsEscalation;
  reason: SeerOutOfCreditsReason;
  autoReloadEnabled?: boolean;
}): string {
  if (escalation === 'configure') {
    return BILLING_MESSAGE[reason][autoReloadEnabled ? 'on' : 'off'];
  }
  return `${MEMBER_LEAD[reason]} ${MEMBER_ASK[escalation]}`;
}

export interface SeerOutOfCreditsNoticeProps extends SeerOutOfCreditsCtaProps {
  escalation: SeerOutOfCreditsEscalation;
  /**
   * Auto reload is on, so the org has used up the top-ups it allows.
   */
  autoReloadEnabled?: boolean;
  /**
   * Where "Configure auto reload" links when there is no in-place modal.
   */
  configureAutoReloadTo?: LinkProps['to'];
  /**
   * The viewer already sent a credits request, so the request button shows
   * "Request sent" instead.
   */
  hasRequestedCredits?: boolean;
  /**
   * Shown while a credits request is sending.
   */
  isRequestingCredits?: boolean;
  /**
   * Opens the auto reload settings in place. Takes precedence over
   * `configureAutoReloadTo`.
   */
  onConfigureAutoReload?: () => void;
  onRequestCredits?: () => void;
}

/**
 * The out-of-credits message and the one action the viewer can take. Product
 * code renders `SeerOutOfCreditsCta`, which picks the escalation for the
 * viewer; this is the presentation underneath it.
 */
export function SeerOutOfCreditsNotice({
  reason,
  variant = 'warning',
  escalation,
  autoReloadEnabled,
  ...actionProps
}: SeerOutOfCreditsNoticeProps) {
  return (
    <Alert variant={variant} data-test-id="seer-out-of-credits">
      <Stack gap="md" align="start">
        <Text>{getSeerOutOfCreditsMessage({reason, escalation, autoReloadEnabled})}</Text>
        <SeerOutOfCreditsAction escalation={escalation} {...actionProps} />
      </Stack>
    </Alert>
  );
}

function SeerOutOfCreditsAction({
  escalation,
  onConfigureAutoReload,
  configureAutoReloadTo,
  onRequestCredits,
  isRequestingCredits,
  hasRequestedCredits,
}: Pick<
  SeerOutOfCreditsNoticeProps,
  | 'escalation'
  | 'onConfigureAutoReload'
  | 'configureAutoReloadTo'
  | 'onRequestCredits'
  | 'isRequestingCredits'
  | 'hasRequestedCredits'
>) {
  if (escalation === 'configure') {
    if (onConfigureAutoReload) {
      return (
        <Button size="sm" onClick={onConfigureAutoReload}>
          {t('Configure auto reload')}
        </Button>
      );
    }
    if (configureAutoReloadTo) {
      return (
        <LinkButton size="sm" to={configureAutoReloadTo}>
          {t('Configure auto reload')}
        </LinkButton>
      );
    }
    return null;
  }

  if (escalation === 'request' && hasRequestedCredits) {
    return (
      <Button size="sm" disabled>
        {t('Request sent')}
      </Button>
    );
  }

  if (escalation === 'request' && onRequestCredits) {
    return (
      <Button size="sm" busy={isRequestingCredits} onClick={onRequestCredits}>
        {t('Request credits')}
      </Button>
    );
  }

  return null;
}
