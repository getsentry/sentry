import {Fragment, useEffect, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {MessagingIntegrationAnalyticsView} from 'sentry/components/messagingIntegrations/setupMessagingIntegrationButton';
import {useScmMessagingIntegrationsQuery} from 'sentry/components/onboarding/scm/useScmMessagingIntegrationsQuery';
import {isIntegrationActive} from 'sentry/components/onboarding/scm/useScmMessagingSetupValidation';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {IntegrationProvider} from 'sentry/types/integrations';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';

interface MsTeamsConnectionProps extends ModalRenderProps {
  onConnected: () => void;
  provider: IntegrationProvider;
}

function MsTeamsConnection({
  Header,
  Body,
  closeModal,
  provider,
  onConnected,
}: MsTeamsConnectionProps) {
  const organization = useOrganization();
  const externalInstall = provider.metadata.aspects.externalInstall;
  const [isWaiting, setIsWaiting] = useState(false);

  const {data: integrations} = useScmMessagingIntegrationsQuery();
  const hasMsteams = (integrations ?? []).some(
    i => i.provider.key === 'msteams' && isIntegrationActive(i)
  );

  // Close and notify once any MS Teams workspace appears in the integrations list —
  // tenant or team. The row will show the correct state (connected / permission-limited)
  // once the query updates in the parent.
  useEffect(() => {
    if (!isWaiting || !hasMsteams) {
      return;
    }
    onConnected();
    closeModal();
  }, [isWaiting, hasMsteams, onConnected, closeModal]);

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
            <Button
              size="sm"
              variant="primary"
              icon={<IconOpen />}
              busy={isWaiting}
              onClick={() => {
                window.open(externalInstall.url, '_blank');
                trackIntegrationAnalytics('integrations.installation_start', {
                  integration: 'msteams',
                  integration_type: 'first_party',
                  is_scm: false,
                  view: MessagingIntegrationAnalyticsView.ONBOARDING,
                  variant: 'scm',
                  already_installed: false,
                  organization,
                });
                setIsWaiting(true);
              }}
            >
              {externalInstall.buttonText}
            </Button>
          ) : null}
        </Stack>
      </Body>
    </Fragment>
  );
}

export function openMsTeamsConnectionModal(
  provider: IntegrationProvider,
  onConnected: () => void
) {
  openModal(
    deps => <MsTeamsConnection {...deps} provider={provider} onConnected={onConnected} />,
    {closeEvents: 'none'}
  );
}
