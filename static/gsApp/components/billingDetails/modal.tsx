import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import BillingDetailsForm from 'getsentry/components/billingDetails/form';
import type {BillingDetails} from 'getsentry/types';

type Props = ModalRenderProps & {
  organization: Organization;
  refetch: () => void;
  initialData?: BillingDetails;
};

function BillingDetailsEditModal({
  Header,
  Body,
  closeModal,
  organization,
  initialData,
  refetch,
}: Props) {
  return (
    <Fragment>
      <Header>{t('Update Billing Details')}</Header>
      <Body>
        <BillingDetailsForm
          organization={organization}
          onSubmitSuccess={() => {
            refetch();
            closeModal();
          }}
          initialData={initialData}
        />
      </Body>
    </Fragment>
  );
}

export default BillingDetailsEditModal;
