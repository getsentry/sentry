import {Fragment, useState} from 'react';

import {Flex} from 'sentry/components/core/layout';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {CheckoutV3StepProps} from 'getsentry/views/amCheckout/types';
import {BillingDetailsPanel} from 'getsentry/views/subscriptionPage/billingDetails';

function InvoiceAddress({
  subscription,
  organization,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  return (
    <BillingDetailsPanel
      organization={organization}
      subscription={subscription}
      isNewBillingUI
    />
  );
}

function AddBillingInformation({
  subscription,
  onEdit,
  stepNumber,
  organization,
}: CheckoutV3StepProps) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <Flex direction="column" gap="xl">
      <StepHeader
        isActive
        isCompleted={false}
        onEdit={onEdit}
        onToggleStep={setIsOpen}
        isOpen={isOpen}
        stepNumber={stepNumber}
        title={t('Add billing information')}
        isNewCheckout
      />
      {isOpen && (
        <Fragment>
          <InvoiceAddress organization={organization} subscription={subscription} />
        </Fragment>
      )}
    </Flex>
  );
}

export default AddBillingInformation;
