import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/codeBlock';
import {Stack} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';

import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Shows the plaintext token once. It lives only in this modal's props: never in the
 * URL, storage or analytics, and it's gone when the modal closes.
 */
export function NewTokenModal({
  Header,
  Body,
  Footer,
  closeModal,
  token,
}: ModalRenderProps & {token: string}) {
  const organization = useOrganization();
  return (
    <Fragment>
      <Header>
        <Heading as="h4">{t('Token created')}</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <Alert.Container>
            <Alert variant="warning">
              {t("Copy this token now. You won't be able to see it again.")}
            </Alert>
          </Alert.Container>
          <TextCopyInput aria-label={t('Generated token')}>{token}</TextCopyInput>
          <Stack gap="sm">
            <Text bold>{t('Example')}</Text>
            <CodeBlock language="bash">
              {`curl -H "Authorization: Bearer $SENTRY_TOKEN" https://sentry.io/api/0/organizations/${organization.slug}/projects/`}
            </CodeBlock>
            <Text size="sm" variant="muted">
              {t(
                'This token uses the same layout as org auth tokens, so sentry-cli reads the org and URL from it.'
              )}
            </Text>
          </Stack>
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
