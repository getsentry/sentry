import {Fragment} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';

interface AutofixGithubAppPermissionsModalProps extends ModalRenderProps {
  installationUrl?: string;
}

const DEFAULT_INSTALLATIONS_URL = 'https://github.com/settings/installations/';

export function AutofixGithubAppPermissionsModal({
  Header,
  Body,
  Footer,
  closeModal,
  installationUrl,
}: AutofixGithubAppPermissionsModalProps) {
  const settingsUrl = installationUrl ?? DEFAULT_INSTALLATIONS_URL;

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">{t('Update GitHub App Permissions')}</Heading>
      </Header>
      <Body>
        <Text as="p">
          {tct(
            'The Sentry GitHub App does not have sufficient permissions to launch a coding agent. Please update your [link:GitHub App installation settings] to grant the required permissions.',
            {
              link: <ExternalLink href={settingsUrl} />,
            }
          )}
        </Text>
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          <Button onClick={closeModal}>{t('Remind me later')}</Button>
          <LinkButton href={settingsUrl} external priority="primary">
            {t('Update Permissions')}
          </LinkButton>
        </Grid>
      </Footer>
    </Fragment>
  );
}
