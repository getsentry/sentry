import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = Pick<ModalRenderProps, 'Body' | 'Header'>;

function MissingPrimaryEmailModal({Header, Body}: Props) {
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  const deadline = isSelfHosted ? 'as soon as possible' : ' before August 1, 2025';
  return (
    <Fragment>
      <Header>
        <Heading>{t('Action Required')}</Heading>
      </Header>
      <Body>
        <TextBlock>
          <p>
            {t(
              "Busted! Looks like you've been flying under the radar without an email address!"
            )}
          </p>
          <p>
            {tct(
              "Sentry accounts need to have an email address. Please add yours [deadline], or we'll have to delete your account.",
              {
                deadline,
              }
            )}
          </p>
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
