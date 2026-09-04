import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {MessagingIntegrationAnalyticsView} from 'sentry/components/messagingIntegrations/setupMessagingIntegrationButton';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {IntegrationProvider} from 'sentry/types/integrations';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';

function MsTeamsConnection({
  Header,
  Body,
  closeModal,
  provider,
}: ModalRenderProps & {provider: IntegrationProvider}) {
  const organization = useOrganization();
  const externalInstall = provider.metadata.aspects.externalInstall;

  return (
    <Fragment>
      <Header closeButton>
        <Text size="lg">{t('Installing Microsoft Teams Integration')}</Text>
      </Header>
      <Body>
        <Stack gap="xl" align="start">
          <Alert variant="info">
            {t(
              "Visit the Teams Marketplace to add Sentry to a team and channel. You'll get a welcome message in the General channel to complete installation."
            )}
          </Alert>
          {externalInstall ? (
            <LinkButton
              size="sm"
              variant="primary"
              icon={<IconOpen />}
              href={externalInstall.url}
              external
              onClick={() => {
                trackIntegrationAnalytics('integrations.installation_start', {
                  integration: 'msteams',
                  integration_type: 'first_party',
                  is_scm: false,
                  view: MessagingIntegrationAnalyticsView.ONBOARDING,
                  variant: 'scm',
                  already_installed: false,
                  organization,
                });
                closeModal();
              }}
            >
              {externalInstall.buttonText}
            </LinkButton>
          ) : null}
        </Stack>
      </Body>
    </Fragment>
  );
}

export function openMsTeamsConnectionModal(provider: IntegrationProvider) {
  openModal(deps => <MsTeamsConnection {...deps} provider={provider} />, {
    closeEvents: 'none',
  });
}
