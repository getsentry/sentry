import {useState} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import useSubscription from 'getsentry/hooks/useSubscription';
import {PlanTier} from 'getsentry/types';
import {hasPartnerMigrationFeature} from 'getsentry/utils/billing';
import AMCheckout from 'getsentry/views/amCheckout';
import {hasNewCheckout} from 'getsentry/views/amCheckout/utils';

function DecideCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const subscription = useSubscription();
  const [legacyTier, setLegacyTier] = useState<string | null>(null);
  const isNewCheckout = hasNewCheckout(organization);

  // if we're showing new checkout, ensure we show the checkout for
  // the current plan tier (we will only toggle between tiers for legacy checkout)
  const tier = isNewCheckout ? (subscription?.planTier ?? null) : legacyTier;

  const checkoutProps = {
    organization,
    onToggleLegacy: setLegacyTier,
    isNewCheckout,
    location,
    navigate,
  };

  const hasAm3Feature = organization.features?.includes('am3-billing');
  const isMigratingPartner = hasPartnerMigrationFeature(organization);
  if (hasAm3Feature || isMigratingPartner) {
    return (
      <ErrorBoundary errorTag={{checkout: PlanTier.AM3}}>
        <AMCheckout checkoutTier={PlanTier.AM3} {...checkoutProps} />
      </ErrorBoundary>
    );
  }

  if (tier !== PlanTier.AM1) {
    return (
      <ErrorBoundary errorTag={{checkout: PlanTier.AM2}}>
        <AMCheckout checkoutTier={PlanTier.AM2} {...checkoutProps} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary errorTag={{checkout: PlanTier.AM1}}>
      <AMCheckout checkoutTier={PlanTier.AM1} {...checkoutProps} />
    </ErrorBoundary>
  );
}

export default DecideCheckout;
