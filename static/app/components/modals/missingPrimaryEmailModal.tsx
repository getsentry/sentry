import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t} from 'sentry/locale';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = Pick<ModalRenderProps, 'Body' | 'Header'>;

function MissingPrimaryEmailModal({Header, Body}: Props) {
  return (
    <Fragment>
      <Header closeButton>{t('Action Required')}</Header>
      <Body>
        <TextBlock>
          {t(
            'Your account is missing a primary email address.\nWe require all Sentry users to have a primary email address. Please add a primary email address to your account within User Settings. If you do not do so within 30 days, your account will be deleted.'
          )}
        </TextBlock>
        <LinkButton to={`/settings/account/emails/`}>
          {t('Go to User Settings')}
        </LinkButton>
      </Body>
    </Fragment>
  );
}

export default MissingPrimaryEmailModal;
