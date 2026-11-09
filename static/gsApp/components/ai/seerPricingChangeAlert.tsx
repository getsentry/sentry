import type {ReactNode} from 'react';
import {IconOpen} from '@sentry/icons/open';

import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';

import {t} from 'sentry/locale';

import type {Subscription} from 'getsentry/types';

const SEER_PRICING_CHANGE_URL =
  'https://www.sentry.help/en/articles/18300945-seer-pricing-changes-code-review-deprecation-december-8-2026';

export function hasPaidSeer(subscription: Subscription) {
  return (
    !subscription.onTrialPlan &&
    !!(subscription.addOns?.seer?.enabled || subscription.addOns?.legacySeer?.enabled)
  );
}

function SeerAnnouncementAlert({children}: {children: ReactNode}) {
  return (
    <Alert
      variant="warning"
      showIcon={false}
      trailingItems={
        <LinkButton
          external
          href={SEER_PRICING_CHANGE_URL}
          icon={<IconOpen />}
          size="xs"
          variant="link"
        >
          {t('Learn more')}
        </LinkButton>
      }
    >
      {children}
    </Alert>
  );
}

export function SeerPricingChangeAlert() {
  return (
    <SeerAnnouncementAlert>
      {t(
        'How we charge for Seer is changing. Seer usage will consume Seer credits starting December 8th, 2026.'
      )}
    </SeerAnnouncementAlert>
  );
}

export function SeerCodeReviewDeprecationAlert() {
  return (
    <SeerAnnouncementAlert>
      {t(
        'Code Review is being deprecated and how we charge for Seer is changing. Starting December 8th, 2026, Seer usage will consume Seer credits.'
      )}
    </SeerAnnouncementAlert>
  );
}
