import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';

import {ModalRenderProps} from 'app/actionCreators/modal';
import Link from 'app/components/links/link';
import {t, tct} from 'app/locale';
import {EmailAddresses} from 'app/views/settings/account/accountEmails';
import TextBlock from 'app/views/settings/components/text/textBlock';

type Props = WithRouterProps &
  Pick<ModalRenderProps, 'Body' | 'Header'> & {
    actionMessage?: string;
  };

function EmailVerificationModal({
  Header,
  Body,
  actionMessage = 'taking this action',
}: Props) {
  return (
    <React.Fragment>
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
    </React.Fragment>
  );
}

export default withRouter(EmailVerificationModal);
export {EmailVerificationModal};
