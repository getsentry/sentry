import {Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import withApi from 'sentry/utils/withApi';
import {EmailAddresses} from 'sentry/views/settings/account/accountEmails';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = WithRouterProps &
  Pick<ModalRenderProps, 'Body' | 'Header'> & {
    api: Client;
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
        <TextBlock>
          {tct('Please verify your email before [actionMessage], or [link].', {
            actionMessage,
            link: (
              <Link to="/settings/account/emails/" data-test-id="email-settings-link">
                {t('go to your email settings')}
              </Link>
            ),
          })}
        </TextBlock>
        <EmailAddresses />
      </Body>
    </Fragment>
  );
}

export default withRouter(withApi(EmailVerificationModal));
export {EmailVerificationModal};
