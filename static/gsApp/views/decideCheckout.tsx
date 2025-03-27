import {useState} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';

import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout';

interface Props extends RouteComponentProps<Record<PropertyKey, unknown>, unknown> {}

function DecideCheckout(props: Props) {
  const organization = useOrganization();
  const [tier, setTier] = useState<string | null>(null);

  const checkoutProps = {...props, organization, onToggleLegacy: setTier};

  const hasAm3Feature = organization.features?.includes('am3-billing');
  const hasPartnerMigrationFeature = organization.features.includes(
    'partner-billing-migration'
  );
  if (hasAm3Feature || hasPartnerMigrationFeature) {
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
