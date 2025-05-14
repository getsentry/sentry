import {Fragment} from 'react';
import type {Location} from 'history';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';

import CreditCardSetup from 'getsentry/components/creditCardSetup';
import type {Subscription} from 'getsentry/types';
import {FTCConsentLocation} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type Props = ModalRenderProps & {
  onSuccess: (data: Subscription) => void;
  organization: Organization;
  subscription: Subscription;
  location?: Location;
};

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
  const budgetModeText = subscription.planDetails.budgetTerm;
  return (
    <Fragment>
      <Header>{t('Update Credit Card')}</Header>
      <Body>
        <CreditCardSetup
          isModal
          organization={organization}
          onCancel={closeModal}
          onSuccess={data => {
            onSuccess(data);
            closeModal();
            trackGetsentryAnalytics('billing_details.updated_cc', {
              organization,
              referrer: decodeScalar(referrer),
            });
          }}
          buttonText={t('Save Changes')}
          referrer={referrer}
          location={FTCConsentLocation.BILLING_DETAILS}
          budgetModeText={budgetModeText}
        />
      </Body>
    </Fragment>
  );
}

export default CreditCardEditModal;
