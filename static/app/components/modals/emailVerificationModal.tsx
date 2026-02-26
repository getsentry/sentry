import {Fragment} from 'react';

import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import {EmailAddresses} from 'sentry/views/settings/account/accountEmails';

type Props = Pick<ModalRenderProps, 'Body' | 'Header'> & {
  actionMessage?: string;
};

function EmailVerificationModal({
  Header,
  Body,
  actionMessage = 'taking this action',
}: Props) {
  return (
    <Fragment>
      <Header closeButton>{t('Action Required')}</Header>
      <Body>
        <Text as="div" density="comfortable">
          {tct('Please verify your email before [actionMessage], or [link].', {
            actionMessage,
            link: (
              <Link to="/settings/account/emails/" data-test-id="email-settings-link">
                {t('go to your email settings')}
              </Link>
            ),
          })}
        </Text>
        <EmailAddresses />
      </Body>
    </Fragment>
  );
}

export default EmailVerificationModal;
