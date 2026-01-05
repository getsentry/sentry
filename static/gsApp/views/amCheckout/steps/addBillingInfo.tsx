import {Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {Flex} from 'sentry/components/core/layout';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';

import BillingDetailsPanel from 'getsentry/components/billingDetails/panel';
import CreditCardPanel from 'getsentry/components/creditCardEdit/panel';
import {useBillingDetails} from 'getsentry/hooks/useBillingDetails';
import {FTCConsentLocation} from 'getsentry/types';
import StepHeader from 'getsentry/views/amCheckout/components/stepHeader';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import {hasBillingInfo} from 'getsentry/views/amCheckout/utils';

function AddBillingInformation({
  subscription,
  stepNumber,
  organization,
  activePlan,
}: StepProps) {
  const location = useLocation();
  const {
    data: billingDetails,
    isLoading: billingDetailsLoading,
    error: billingDetailsError,
  } = useBillingDetails();
  const showEditBillingInfo = hasBillingInfo(billingDetails, subscription, false);

  return (
    <Flex direction="column" gap="xl">
      {billingDetailsError && (
        <Alert variant="danger">{billingDetailsError.message}</Alert>
      )}
      <StepHeader
        stepNumber={stepNumber}
        title={
          showEditBillingInfo
            ? t('Edit billing information')
            : t('Add billing information')
        }
      />
      {billingDetailsLoading ? (
        <LoadingIndicator />
      ) : (
        <Fragment>
          <BillingDetailsPanel
            organization={organization}
            subscription={subscription}
            isNewBillingUI
            analyticsEvent="checkout.updated_billing_details"
            shouldExpandInitially
          />
          <CreditCardPanel
            organization={organization}
            subscription={subscription}
            isNewBillingUI
            location={location}
            ftcLocation={FTCConsentLocation.CHECKOUT}
            budgetTerm={activePlan.budgetTerm}
            analyticsEvent="checkout.updated_cc"
            shouldExpandInitially
          />
        </Fragment>
      )}
    </Flex>
  );
}

export default AddBillingInformation;
