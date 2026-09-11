import {Fragment} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';

interface MissingFeature {
  description: string;
  key: string;
  name: string;
}

interface AutofixGithubAppPermissionsModalProps extends ModalRenderProps {
  /** Which flow opened the modal; selects the copy. */
  variant: 'pr_iteration' | 'coding_agent_handoff' | 'integration_settings';
  /** GitHub permissions URL for the install. Falls back to GitHub's installations index. */
  installationUrl?: string;
  /** Feature tiers the install is missing; rendered by the `integration_settings` variant. */
  missingFeatures?: MissingFeature[];
}

const DEFAULT_INSTALLATIONS_URL = 'https://github.com/settings/installations/';

export function AutofixGithubAppPermissionsModal({
  Header,
  Body,
  Footer,
  closeModal,
  installationUrl,
  variant,
  missingFeatures,
}: AutofixGithubAppPermissionsModalProps) {
  const settingsUrl = installationUrl ?? DEFAULT_INSTALLATIONS_URL;

  const settingsSentence = tct(
    'Please update your [link:GitHub App installation settings] to grant the required permissions.',
    {link: <ExternalLink href={settingsUrl} />}
  );

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">{t('Update GitHub App Permissions')}</Heading>
      </Header>
      <Body>
        {variant === 'pr_iteration' ? (
          <Text as="p">
            {t(
              'Seer needs additional GitHub App permissions to keep iterating on the pull requests in this run and get CI passing.'
            )}{' '}
            {t('Review and accept the updated permissions to let Seer continue.')}
          </Text>
        ) : variant === 'coding_agent_handoff' ? (
          <Text as="p">
            {t(
              'The Sentry GitHub App does not have sufficient permissions to launch a coding agent.'
            )}{' '}
            {settingsSentence}
          </Text>
        ) : (
          <Stack gap="lg">
            <Text as="p">
              {t('This installation is missing permissions for the following features:')}
            </Text>
            <ul>
              {missingFeatures?.map(feature => (
                <li key={feature.key}>
                  <Text>{feature.description}</Text>
                </li>
              ))}
            </ul>
            <Text as="p">{settingsSentence}</Text>
          </Stack>
        )}
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          <Button onClick={closeModal}>{t('Remind me later')}</Button>
          <LinkButton
            href={settingsUrl}
            external
            variant="primary"
            onClick={() => {
              closeModal();
            }}
          >
            {t('Update Permissions')}
          </LinkButton>
        </Grid>
      </Footer>
    </Fragment>
  );
}
