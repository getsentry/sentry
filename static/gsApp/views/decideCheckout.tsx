import {useEffect, useState} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import useSubscription from 'getsentry/hooks/useSubscription';
import {PlanTier} from 'getsentry/types';
import {hasNewBillingUI, hasPartnerMigrationFeature} from 'getsentry/utils/billing';
import AMCheckout from 'getsentry/views/amCheckout';

function DecideCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const subscription = useSubscription();
  const [tier, setTier] = useState<string | null>(null);
  const isNewCheckout = hasNewBillingUI(organization);

  useEffect(() => {
    // if we're showing new checkout, ensure we show the checkout for
    // the current plan tier (we will not toggle between tiers for legacy checkout)
    if (isNewCheckout) {
      setTier(subscription?.planTier ?? null);
    }
  }, [subscription?.planTier, isNewCheckout]);

  const checkoutProps = {
    organization,
    onToggleLegacy: setTier,
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
