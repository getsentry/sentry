import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import {openModal} from 'sentry/actionCreators/modal';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';

export function displayNewToken(token: string, onClose: () => void) {
  openModal(
    ({Body, Footer, closeModal}) => (
      <Fragment>
        <Body>
          <Alert.Container>
            <Alert variant="warning" showIcon={false}>
              {t("Please copy this token to a safe place — it won't be shown again!")}
            </Alert>
          </Alert.Container>
          <TextCopyInput aria-label={t('Generated token')}>{token}</TextCopyInput>
        </Body>
        <Footer>
          <Button onClick={closeModal} priority="primary">
            {t("I've saved it")}
          </Button>
        </Footer>
      </Fragment>
    ),
    {closeEvents: 'none', onClose}
  );
}
