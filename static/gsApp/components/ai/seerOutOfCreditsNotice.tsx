import styled from '@emotion/styled';
import {IconMail} from '@sentry/icons/mail';

import {Alert} from '@sentry/scraps/alert';
import {Button, type ButtonProps} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import type {
  SeerOutOfCreditsCtaProps,
  SeerOutOfCreditsReason,
} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {t, tct} from 'sentry/locale';
import type {SeerCreditDenialReason} from 'sentry/utils/seer/useSeerCreditCheck';

/**
 * What the viewer can do about running out of credits:
 *
 * - `configure`: billing members configure auto-reload themselves.
 * - `request`: everyone else emails their admins with "Contact Admin".
 * - `contact`: orgs that can't self-serve buy credits through their account
 *   team, so members get no button and are only told who to ask.
 */
export type SeerOutOfCreditsEscalation = 'configure' | 'request' | 'contact';

// Billing members, from the Billing Gates designs.
const BILLING_MESSAGE: Record<SeerOutOfCreditsReason, string> = {
  'agent-chat': t(
    'Your organization does not have enough credits left for you to message Seer. Adjust your spend and turn on auto-reload.'
  ),
  'autofix-start': t(
    'You do not have enough credits to start an Autofix run. Set up auto-reload to keep your flow uninterrupted.'
  ),
  'autofix-continue': t(
    'Your organization does not have enough credits to continue your Autofix run. Set up auto-reload to keep your flow uninterrupted.'
  ),
};

// Members, from the designs' member flow. "Contact Admin" says who to ask, so
// the chat copy stops at its first sentence.
const MEMBER_MESSAGE: Record<SeerOutOfCreditsReason, string> = {
  'agent-chat': t(
    'Your organization does not have enough credits left for you to message Seer.'
  ),
  'autofix-start': t(
    'Your organization does not have enough credits to start an Autofix run. Ask your admin to increase your daily usage limit or set up auto-reload.'
  ),
  'autofix-continue': t(
    'Your organization does not have enough credits to continue your Autofix run. Ask your admin to increase your daily usage limit or set up auto-reload.'
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

// From the Agent Chat designs, for an org that hit its daily usage limit, and
// the same for Autofix. Members can't raise the limit, so their copy says who
// can.
const DAILY_LIMIT_MESSAGE: Record<
  SeerOutOfCreditsReason,
  Record<'configure' | 'member', string>
> = {
  'agent-chat': {
    configure: t(
      'Your organization hit its daily usage limit, so you cannot continue messaging Seer.'
    ),
    member: t(
      'Your organization hit its daily usage limit, so you cannot continue messaging Seer. If you want to increase your limit, reach out to your admin.'
    ),
  },
  'autofix-start': {
    configure: t(
      'Your organization hit its daily usage limit, so you cannot start an Autofix run.'
    ),
    member: t(
      'Your organization hit its daily usage limit, so you cannot start an Autofix run. If you want to increase your limit, reach out to your admin.'
    ),
  },
  'autofix-continue': {
    configure: t(
      'Your organization hit its daily usage limit, so you cannot continue your Autofix run.'
    ),
    member: t(
      'Your organization hit its daily usage limit, so you cannot continue your Autofix run. If you want to increase your limit, reach out to your admin.'
    ),
  },
};

/**
 * When the daily usage limit resets. Billing counts a day's spend by its UTC
 * date, so it resets at the next midnight UTC.
 */
function getDailyLimitResetsAt(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
}

function getSeerOutOfCreditsMessage({
  reason,
  escalation,
  isDailyLimitReached,
}: {
  escalation: SeerOutOfCreditsEscalation;
  isDailyLimitReached: boolean;
  reason: SeerOutOfCreditsReason;
}): string {
  if (isDailyLimitReached) {
    return DAILY_LIMIT_MESSAGE[reason][
      escalation === 'configure' ? 'configure' : 'member'
    ];
  }
  if (escalation === 'configure') {
    return BILLING_MESSAGE[reason];
  }
  return escalation === 'request' ? MEMBER_MESSAGE[reason] : CONTACT_MESSAGE[reason];
}

export interface SeerOutOfCreditsNoticeProps extends Omit<
  SeerOutOfCreditsCtaProps,
  'denialReason'
> {
  escalation: SeerOutOfCreditsEscalation;
  /**
   * Auto-reload is on. It reloads credits as they run low, so running out
   * anyway means the org hit its daily usage limit. Only billing members can
   * read it.
   */
  autoReloadEnabled?: boolean;
  denialReason?: SeerCreditDenialReason | null;
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
  denialReason,
  size,
  variant = 'warning',
  escalation,
  autoReloadEnabled,
  ...actionProps
}: SeerOutOfCreditsNoticeProps) {
  const NoticeAlert = variant === 'muted' ? MutedAlert : Alert;
  // The chat has room for a full-size button; Autofix's spots are tighter.
  const buttonSize = size ?? (reason === 'agent-chat' ? 'md' : 'sm');
  const isDailyLimitReached =
    denialReason === 'daily_cap_exceeded' || !!autoReloadEnabled;

  return (
    <NoticeAlert variant={variant} data-test-id="seer-out-of-credits">
      <Stack gap="md" align="start">
        <Text>
          {getSeerOutOfCreditsMessage({reason, escalation, isDailyLimitReached})}
        </Text>
        {isDailyLimitReached && (
          <Text>
            {tct('This will reset at [time].', {
              time: <DateTime date={getDailyLimitResetsAt()} timeOnly timeZone />,
            })}
          </Text>
        )}
        <SeerOutOfCreditsAction
          escalation={escalation}
          // The designs only ask billing members to turn auto-reload on from
          // the chat when it's off; otherwise they configure it, which is also
          // where the daily usage limit is set.
          configureLabel={
            reason === 'agent-chat' && !isDailyLimitReached
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
