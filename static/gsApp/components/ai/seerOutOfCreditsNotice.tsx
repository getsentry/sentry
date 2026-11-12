import styled from '@emotion/styled';
import {IconMail} from '@sentry/icons/mail';

import {Alert} from '@sentry/scraps/alert';
import {Button, type ButtonProps} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {
  SeerOutOfCreditsCtaProps,
  SeerOutOfCreditsReason,
} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {t} from 'sentry/locale';

/**
 * What the viewer can do about running out of credits:
 *
 * - `configure`: billing members configure auto-reload themselves.
 * - `request`: everyone else emails their admins with "Contact Admin".
 * - `contact`: orgs that can't self-serve buy credits through their account
 *   team, so members get no button and are only told who to ask.
 */
export type SeerOutOfCreditsEscalation = 'configure' | 'request' | 'contact';

// Billing members, from the Billing Gates designs. Auto-reload already on means
// the org ran through the top-ups it allows, so the copy says so.
const BILLING_MESSAGE: Record<SeerOutOfCreditsReason, Record<'off' | 'on', string>> = {
  'agent-chat': {
    off: t(
      'Your organization does not have enough credits left for you to message Seer. Adjust your spend and turn on auto-reload.'
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

// Members, from the designs' member flow. "Contact Admin" says who to ask, so
// the chat copy stops at its first sentence.
const MEMBER_MESSAGE: Record<SeerOutOfCreditsReason, string> = {
  'agent-chat': t(
    'Your organization does not have enough credits left for you to message Seer.'
  ),
  'autofix-start': t(
    'Your organization does not have enough credits to start an Autofix run. Ask your admin to increase your daily token limit or set up auto top-up.'
  ),
  'autofix-continue': t(
    'Your organization does not have enough credits to continue your Autofix run. Ask your admin to increase your daily token limit or set up auto top-up.'
  ),
};

// Members of orgs that can't self-serve get no button, so the chat copy says
// who to ask too.
const CONTACT_MESSAGE: Record<SeerOutOfCreditsReason, string> = {
  ...MEMBER_MESSAGE,
  'agent-chat': t(
    'Your organization does not have enough credits left for you to message Seer. Ask your admin to set up auto-reload.'
  ),
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
  return escalation === 'request' ? MEMBER_MESSAGE[reason] : CONTACT_MESSAGE[reason];
}

export interface SeerOutOfCreditsNoticeProps extends SeerOutOfCreditsCtaProps {
  escalation: SeerOutOfCreditsEscalation;
  /**
   * Auto-reload is on, so the org has used up the top-ups it allows.
   */
  autoReloadEnabled?: boolean;
  /**
   * The viewer already emailed their admins, so "Contact Admin" shows
   * "Admins emailed" instead.
   */
  hasRequestedCredits?: boolean;
  /**
   * Shown while a credits request is sending.
   */
  isRequestingCredits?: boolean;
  /**
   * Opens the auto-reload settings in place.
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
  size,
  variant = 'warning',
  escalation,
  autoReloadEnabled,
  ...actionProps
}: SeerOutOfCreditsNoticeProps) {
  const NoticeAlert = variant === 'muted' ? MutedAlert : Alert;
  // The chat has room for a full-size button; Autofix's spots are tighter.
  const buttonSize = size ?? (reason === 'agent-chat' ? 'md' : 'sm');

  return (
    <NoticeAlert variant={variant} data-test-id="seer-out-of-credits">
      <Stack gap="md" align="start">
        <Text>{getSeerOutOfCreditsMessage({reason, escalation, autoReloadEnabled})}</Text>
        <SeerOutOfCreditsAction
          escalation={escalation}
          // The designs only ask billing members to turn auto-reload on from
          // the chat; everywhere else they configure it.
          configureLabel={
            reason === 'agent-chat' && !autoReloadEnabled
              ? t('Turn on auto-reload')
              : t('Configure auto-reload')
          }
          size={buttonSize}
          {...actionProps}
        />
      </Stack>
    </NoticeAlert>
  );
}

/**
 * The Billing Gates designs grey the muted notice's icon column, which the
 * muted Alert leaves white. Paints over the Alert's icon column, the 43px left
 * of the divider it draws, and leaves the icon above it.
 */
const MutedAlert = styled(Alert)`
  &::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 43px;
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

function SeerOutOfCreditsAction({
  escalation,
  configureLabel,
  size,
  onConfigureAutoReload,
  onRequestCredits,
  isRequestingCredits,
  hasRequestedCredits,
}: {
  configureLabel: string;
  size: ButtonProps['size'];
} & Pick<
  SeerOutOfCreditsNoticeProps,
  | 'escalation'
  | 'onConfigureAutoReload'
  | 'onRequestCredits'
  | 'isRequestingCredits'
  | 'hasRequestedCredits'
>) {
  if (escalation === 'configure' && onConfigureAutoReload) {
    return (
      <Button size={size} onClick={onConfigureAutoReload}>
        {configureLabel}
      </Button>
    );
  }

  if (escalation === 'request' && hasRequestedCredits) {
    return (
      <Button size={size} icon={<IconMail />} disabled>
        {t('Admins emailed')}
      </Button>
    );
  }

  if (escalation === 'request' && onRequestCredits) {
    return (
      <Button
        size={size}
        icon={<IconMail />}
        busy={isRequestingCredits}
        onClick={onRequestCredits}
      >
        {t('Contact Admin')}
      </Button>
    );
  }

  return null;
}
