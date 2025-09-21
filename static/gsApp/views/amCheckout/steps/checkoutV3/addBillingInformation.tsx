import {Fragment, useState} from 'react';

import {Flex} from 'sentry/components/core/layout';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';

import {FTCConsentLocation} from 'getsentry/types';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {CheckoutV3StepProps} from 'getsentry/views/amCheckout/types';
import {
  BillingDetailsPanel,
  PaymentMethodPanel,
} from 'getsentry/views/subscriptionPage/billingDetails';

function AddBillingInformation({
  subscription,
  onEdit,
  stepNumber,
  organization,
  activePlan,
}: CheckoutV3StepProps) {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();

  return (
    <Flex direction="column" gap="xl">
      <StepHeader
        isActive
        isCompleted={false}
        onEdit={onEdit}
        onToggleStep={setIsOpen}
        isOpen={isOpen}
        stepNumber={stepNumber}
        title={t('Add or edit billing information')}
        isNewCheckout
      />
      {isOpen && (
        <Fragment>
          <BillingDetailsPanel
            organization={organization}
            subscription={subscription}
            isNewBillingUI
          />
          <PaymentMethodPanel
            organization={organization}
            subscription={subscription}
            isNewBillingUI
            location={location}
            ftcLocation={FTCConsentLocation.CHECKOUT}
            budgetTerm={activePlan.budgetTerm}
          />
        </Fragment>
      )}
    </Flex>
  );
}

export default AddBillingInformation;
