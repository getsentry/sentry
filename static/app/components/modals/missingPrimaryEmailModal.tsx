import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = Pick<ModalRenderProps, 'Body' | 'Header'>;

function MissingPrimaryEmailModal({Header, Body}: Props) {
  return (
    <Fragment>
      <Header>
        <Heading>{t('Action Required')}</Heading>
      </Header>
      <Body>
        <TextBlock>{t('Your account doesn't have an email address!')}</TextBlock>
        <TextBlock>
          {t(
            ' We require all Sentry users to have a primary email address. Please add a primary email address to your account within User Settings. If you do not do so within 30 days, your account will be deleted.'
          )}
        </TextBlock>
        <LinkButton to={`/settings/account/emails/`} priority="primary">
          {t('Go to User Settings')}
        </LinkButton>
      </Body>
    </Fragment>
  );
}

export default MissingPrimaryEmailModal;

const Heading = styled('h1')`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.headerFontSize};
  margin-top: 0;
  margin-bottom: ${space(0.75)};
`;
