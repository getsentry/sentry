import {Fragment, useEffect, useState} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import BillingDetailsForm from 'getsentry/components/billingDetailsForm';
import type {BillingDetails} from 'getsentry/types';

type Props = ModalRenderProps & {
  initialData: BillingDetails | null;
  organization: Organization;
};

function BillingDetailsEditModal({
  Header,
  Body,
  closeModal,
  organization,
  initialData,
}: Props) {
  const [data, setData] = useState<BillingDetails | null>(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (initialData) {
      setData(initialData);
    } else {
      setData(null);
    }
    setLoading(false);
  }, [initialData]);

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <Fragment>
      <Header>{t('Update Billing Details')}</Header>
      <Body>
        <BillingDetailsForm
          organization={organization}
          onSubmitSuccess={() => {
            closeModal();
          }}
          initialData={data ?? undefined}
        />
      </Body>
    </Fragment>
  );
}

export default BillingDetailsEditModal;
