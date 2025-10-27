import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button/linkButton';

import {IconChevron, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import {hasNewBillingUI} from 'getsentry/utils/billing';

function PaymentFailureAlert({
  subscription,
  organization,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const isNewBillingUI = hasNewBillingUI(organization);
  if (!subscription.isPastDue || !isNewBillingUI) {
    return null;
  }

  return (
    <Alert
      type="error"
      icon={<IconWarning />}
      trailingItems={
        <LinkButton
          to={`/settings/${organization.slug}/billing/details/`}
          icon={<IconChevron direction="right" />}
          borderless
        />
      }
    >
      {t(
        'Automatic payment failed. Update your payment method to ensure uninterrupted access to Sentry.'
      )}
    </Alert>
  );
}

export default PaymentFailureAlert;
