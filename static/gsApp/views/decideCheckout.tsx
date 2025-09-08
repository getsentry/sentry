import {useState} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import {PlanTier} from 'getsentry/types';
import {hasPartnerMigrationFeature} from 'getsentry/utils/billing';
import AMCheckout from 'getsentry/views/amCheckout';
import {hasCheckoutV3} from 'getsentry/views/amCheckout/utils';

function DecideCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const [tier, setTier] = useState<string | null>(null);

  const checkoutProps = {
    organization,
    onToggleLegacy: setTier,
    isNewCheckout: hasCheckoutV3(organization),
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
