import {Fragment} from 'react';
import type {Location} from 'history';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';

import CreditCardSetup from 'getsentry/components/creditCardSetup';
import type {Subscription} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type Props = ModalRenderProps & {
  onSuccess: (data: Subscription) => void;
  organization: Organization;
  location?: Location;
};

function CreditCardEditModal({
  Header,
  Body,
  closeModal,
  organization,
  onSuccess,
  location,
}: Props) {
  const referrer = decodeScalar(location?.query?.referrer);
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
        />
      </Body>
    </Fragment>
  );
}

export default CreditCardEditModal;
