import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

import AMCheckout from 'getsentry/views/amCheckout';

// The checkout tier is resolved server-side (the billing-config endpoint
// resolves `tier=checkout`), so this view no longer needs to pick a tier — it
// just renders the checkout.
function DecideCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  return (
    <ErrorBoundary>
      <AMCheckout organization={organization} location={location} navigate={navigate} />
    </ErrorBoundary>
  );
}

export default DecideCheckout;
