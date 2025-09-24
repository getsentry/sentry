import {Fragment, useState} from 'react';

import {Flex} from 'sentry/components/core/layout';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';

import BillingDetailsPanel from 'getsentry/components/billingDetails/panel';
import CreditCardPanel from 'getsentry/components/creditCardEdit/panel';
import {useBillingDetails} from 'getsentry/hooks/useBillingDetails';
import {FTCConsentLocation} from 'getsentry/types';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {CheckoutV3StepProps} from 'getsentry/views/amCheckout/types';
import {hasBillingInfo} from 'getsentry/views/amCheckout/utils';

function AddBillingInformation({
  subscription,
  onEdit,
  stepNumber,
  organization,
  activePlan,
}: CheckoutV3StepProps) {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();
  const {data: billingDetails} = useBillingDetails();
  const showEditBillingInfo = hasBillingInfo(billingDetails, subscription, false);

  return (
    <Flex direction="column" gap="xl">
      <StepHeader
        isActive
        isCompleted={false}
        onEdit={onEdit}
        onToggleStep={setIsOpen}
        isOpen={isOpen}
        stepNumber={stepNumber}
        title={
          showEditBillingInfo
            ? t('Edit billing information')
            : t('Add billing information')
        }
        isNewCheckout
      />
      {isOpen && (
        <Fragment>
          <BillingDetailsPanel
            organization={organization}
            subscription={subscription}
            isNewBillingUI
            analyticsEvent="checkout.updated_billing_details"
          />
          <CreditCardPanel
            organization={organization}
            subscription={subscription}
            isNewBillingUI
            location={location}
            ftcLocation={FTCConsentLocation.CHECKOUT}
            budgetTerm={activePlan.budgetTerm}
            analyticsEvent="checkout.updated_cc"
          />
        </Fragment>
      )}
    </Flex>
  );
}

export default AddBillingInformation;
