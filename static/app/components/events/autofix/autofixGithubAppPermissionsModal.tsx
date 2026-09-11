import {Fragment} from 'react';
import type {ReactNode} from 'react';

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

const DEFAULT_INSTALLATIONS_URL = 'https://github.com/settings/installations/';

interface VariantProps extends ModalRenderProps {
  /** GitHub permissions URL for the install. Falls back to GitHub's installations index. */
  installationUrl?: string;
}

/** The linked "update settings" sentence shared by a few of the variants. */
function updateSettingsSentence(installationUrl?: string) {
  return tct(
    'Please update your [link:GitHub App installation settings] to grant the required permissions.',
    {link: <ExternalLink href={installationUrl ?? DEFAULT_INSTALLATIONS_URL} />}
  );
}

/** Shared chrome (heading + footer) that each variant renders its body into. */
function PermissionsModal({
  Header,
  Body,
  Footer,
  closeModal,
  installationUrl,
  children,
}: VariantProps & {children: ReactNode}) {
  const settingsUrl = installationUrl ?? DEFAULT_INSTALLATIONS_URL;

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">{t('Update GitHub App Permissions')}</Heading>
      </Header>
      <Body>{children}</Body>
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

/** PR-iteration flow: Seer is blocked from iterating on the run's pull requests. */
export function PrIterationPermissionsModal(props: VariantProps) {
  return (
    <PermissionsModal {...props}>
      <Text as="p">
        {t(
          'Seer needs additional GitHub App permissions to keep iterating on the pull requests in this run and get CI passing.'
        )}{' '}
        {t('Review and accept the updated permissions to let Seer continue.')}
      </Text>
    </PermissionsModal>
  );
}

/** Coding-agent handoff flow. */
export function CodingAgentHandoffPermissionsModal(props: VariantProps) {
  return (
    <PermissionsModal {...props}>
      <Text as="p">
        {t(
          'The Sentry GitHub App does not have sufficient permissions to launch a coding agent.'
        )}{' '}
        {updateSettingsSentence(props.installationUrl)}
      </Text>
    </PermissionsModal>
  );
}

/** Integration settings page: names the feature tiers the install is missing. */
export function IntegrationSettingsPermissionsModal({
  missingFeatures,
  ...props
}: VariantProps & {missingFeatures?: MissingFeature[]}) {
  return (
    <PermissionsModal {...props}>
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
        <Text as="p">{updateSettingsSentence(props.installationUrl)}</Text>
      </Stack>
    </PermissionsModal>
  );
}
