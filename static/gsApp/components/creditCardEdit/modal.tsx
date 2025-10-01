import {Fragment} from 'react';
import type {Location} from 'history';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';

import CreditCardSetup from 'getsentry/components/creditCardEdit/setup';
import type {Subscription} from 'getsentry/types';
import {FTCConsentLocation} from 'getsentry/types';

type Props = ModalRenderProps & {
  onSuccess: (data: Subscription) => void;
  organization: Organization;
  subscription: Subscription;
  location?: Location;
};

/**
 * Modal for editing the customer's payment method.
 */
function CreditCardEditModal({
  Header,
  Body,
  closeModal,
  organization,
  onSuccess,
  location,
  subscription,
}: Props) {
  const referrer = decodeScalar(location?.query?.referrer);
  const budgetTerm = subscription.planDetails.budgetTerm;

  return (
    <Fragment>
      <Header>{t('Update Credit Card')}</Header>
      <Body>
        <CreditCardSetup
          isModal
          onCancel={closeModal}
          onSuccessWithSubscription={onSuccess}
          onSuccess={closeModal}
          analyticsEvent="billing_details.updated_cc"
          organization={organization}
          location={FTCConsentLocation.BILLING_DETAILS}
          referrer={referrer}
          budgetTerm={budgetTerm}
          buttonText={t('Save Changes')}
        />
      </Body>
    </Fragment>
  );
}

export default CreditCardEditModal;
