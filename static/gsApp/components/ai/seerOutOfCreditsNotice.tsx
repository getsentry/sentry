import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import type {LinkProps} from '@sentry/scraps/link';

import {t} from 'sentry/locale';

/**
 * What the viewer can do about running out of credits:
 *
 * - `top-up`: billing members add credits themselves.
 * - `request`: everyone else asks the billing members to add credits.
 * - `contact`: orgs that can't self-serve buy credits through their account
 *   team, so members get no button and are only told who to ask.
 */
export type SeerOutOfCreditsEscalation = 'top-up' | 'request' | 'contact';

export interface SeerOutOfCreditsNoticeProps {
  escalation: SeerOutOfCreditsEscalation;
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
   * Replaces the default headline, for example to say a run stopped part way.
   */
  message?: React.ReactNode;
  onRequestCredits?: () => void;
  /**
   * Opens the top-up flow in place. Takes precedence over `topUpTo`.
   */
  onTopUp?: () => void;
  /**
   * Where "Top up" links to when there is no in-place top-up flow.
   */
  topUpTo?: LinkProps['to'];
}

const ESCALATION_DETAIL: Record<SeerOutOfCreditsEscalation, string> = {
  'top-up': t('Top up to keep using Seer.'),
  request: t('Ask someone with billing access to add more.'),
  contact: t('Ask someone with billing access in your organization to add more.'),
};

/**
 * The out-of-credits message and the one action the viewer can take. Product
 * code renders `SeerOutOfCreditsCta`, which picks the escalation for the
 * viewer; this is the presentation underneath it.
 */
export function SeerOutOfCreditsNotice({
  escalation,
  message,
  onTopUp,
  topUpTo,
  onRequestCredits,
  isRequestingCredits,
  hasRequestedCredits,
}: SeerOutOfCreditsNoticeProps) {
  return (
    <Alert
      variant="warning"
      data-test-id="seer-out-of-credits"
      trailingItems={
        <SeerOutOfCreditsAction
          escalation={escalation}
          onTopUp={onTopUp}
          topUpTo={topUpTo}
          onRequestCredits={onRequestCredits}
          isRequestingCredits={isRequestingCredits}
          hasRequestedCredits={hasRequestedCredits}
        />
      }
    >
      {message ?? t('Your organization is out of Seer credits.')}{' '}
      {ESCALATION_DETAIL[escalation]}
    </Alert>
  );
}

function SeerOutOfCreditsAction({
  escalation,
  onTopUp,
  topUpTo,
  onRequestCredits,
  isRequestingCredits,
  hasRequestedCredits,
}: Omit<SeerOutOfCreditsNoticeProps, 'message'>) {
  if (escalation === 'top-up') {
    if (onTopUp) {
      return <Alert.Button onClick={onTopUp}>{t('Top up')}</Alert.Button>;
    }
    if (topUpTo) {
      return (
        <LinkButton size="zero" to={topUpTo}>
          {t('Top up')}
        </LinkButton>
      );
    }
    return null;
  }

  if (escalation === 'request' && hasRequestedCredits) {
    return <Alert.Button disabled>{t('Request sent')}</Alert.Button>;
  }

  if (escalation === 'request' && onRequestCredits) {
    return (
      <Alert.Button busy={isRequestingCredits} onClick={onRequestCredits}>
        {t('Request credits')}
      </Alert.Button>
    );
  }

  return null;
}
