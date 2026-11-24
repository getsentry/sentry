import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';

import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';

import type {NewServiceAccountToken} from './types';

/**
 * The API returns a token's value only when it's created, so this modal is the only
 * place it's shown. Keep it out of the URL, storage and analytics.
 */
export function NewTokenModal({
  Header,
  Body,
  Footer,
  closeModal,
  token,
}: ModalRenderProps & {token: NewServiceAccountToken}) {
  return (
    <Fragment>
      <Header>
        <Heading as="h4">{t('Token created')}</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <Alert.Container>
            <Alert variant="warning">
              {t('Copy this token now. You won’t be able to see it again.')}
            </Alert>
          </Alert.Container>
          <Stack gap="sm">
            <Text bold>{token.name}</Text>
            <TextCopyInput aria-label={t('Generated token')}>{token.token}</TextCopyInput>
          </Stack>
          <Text size="sm" variant="muted">
            {t(
              'Send it in the Authorization header as a Bearer token. Store it somewhere secret, such as your CI provider’s secrets.'
            )}
          </Text>
        </Stack>
      </Body>
      <Footer>
        <Button variant="primary" onClick={closeModal}>
          {t('Done')}
        </Button>
      </Footer>
    </Fragment>
  );
}
