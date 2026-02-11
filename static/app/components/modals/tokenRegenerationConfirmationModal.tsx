import {Fragment} from 'react';

import {Grid} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';

export interface TokenRegenerationConfirmationModalProps {
  token: string;
}

type Props = ModalRenderProps & TokenRegenerationConfirmationModalProps;

function TokenRegenerationConfirmationModal({Header, Body, token}: Props) {
  return (
    <Fragment>
      <Header closeButton>
        <h5>{t('Token created')}</h5>
      </Header>
      <Body>
        <Grid columns="1fr 2fr" gap="md">
          <TextCopyInput size="sm" aria-label={t('Prevent Variable')}>
            SENTRY_PREVENT_TOKEN
          </TextCopyInput>
          <TextCopyInput size="sm" aria-label={t('Token')}>
            {token}
          </TextCopyInput>
        </Grid>
      </Body>
    </Fragment>
  );
}

export default TokenRegenerationConfirmationModal;
