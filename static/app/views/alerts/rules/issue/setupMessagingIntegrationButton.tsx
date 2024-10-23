import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {
  IntegrationProvider,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getIntegrationFeatureGate} from 'sentry/utils/integrationUtil';
import {useApiQueries, useApiQuery} from 'sentry/utils/queryClient';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import MessagingIntegrationModal from 'sentry/views/alerts/rules/issue/messagingIntegrationModal';

export enum MessagingIntegrationAnalyticsView {
  ALERT_RULE_CREATION = 'alert_rule_creation',
  PROJECT_CREATION = 'project_creation',
}

type Props = {
  analyticsParams?: {
    view: MessagingIntegrationAnalyticsView;
  };
  projectId?: string;
  refetchConfigs?: () => void;
};

function SetupMessagingIntegrationButton({
  refetchConfigs,
  analyticsParams,
  projectId,
}: Props) {
  const providerKeys = ['slack', 'discord', 'msteams'];
  const organization = useOrganization();

  const onAddIntegration = () => {
    messagingIntegrationsQuery.refetch();
    if (refetchConfigs) {
      refetchConfigs();
    }
  };

  const messagingIntegrationsQuery = useApiQuery<OrganizationIntegration[]>(
    [`/organizations/${organization.slug}/integrations/?integrationType=messaging`],
    {staleTime: Infinity}
  );

  const integrationProvidersQuery = useApiQueries<{providers: IntegrationProvider[]}>(
    providerKeys.map((providerKey: string) => [
      `/organizations/${organization.slug}/config/integrations/?provider_key=${providerKey}`,
    ]),
    {staleTime: Infinity}
  );

  const {IntegrationFeatures} = getIntegrationFeatureGate();

  const shouldRenderSetupButton = messagingIntegrationsQuery.data?.every(
    integration => integration.status !== 'active'
  );

  useRouteAnalyticsParams({
    setup_message_integration_button_shown: shouldRenderSetupButton,
  });

  if (
    messagingIntegrationsQuery.isPending ||
    messagingIntegrationsQuery.isError ||
    integrationProvidersQuery.some(({isPending}) => isPending) ||
    integrationProvidersQuery.some(({isError}) => isError) ||
    integrationProvidersQuery[0].data == null
  ) {
    return null;
  }

  if (!shouldRenderSetupButton) {
    return null;
  }

  return (
    <IntegrationFeatures
      organization={organization}
      features={integrationProvidersQuery[0].data.providers[0]?.metadata?.features}
    >
      {({disabled, disabledReason}) => (
        <div>
          <Button
            size="sm"
            icon={
              <IconWrapper>
                {providerKeys.map((value: string) => {
                  return <PluginIcon key={value} pluginId={value} size={16} />;
                })}
              </IconWrapper>
            }
            disabled={disabled}
            title={
              disabled
                ? disabledReason
                : t('Send alerts to your messaging service. Install the integration now.')
            }
            onClick={() => {
              openModal(
                deps => (
                  <MessagingIntegrationModal
                    {...deps}
                    headerContent={t('Connect with a messaging tool')}
                    bodyContent={t('Receive alerts and digests right where you work.')}
                    providers={integrationProvidersQuery
                      .map(result => result.data?.providers[0])
                      .filter(
                        (provider): provider is IntegrationProvider =>
                          provider !== undefined
                      )}
                    onAddIntegration={onAddIntegration}
                    {...(projectId && {modalParams: {projectId: projectId}})}
                  />
                ),
                {
                  closeEvents: 'escape-key',
                }
              );
              trackAnalytics('onboarding.messaging_integration_modal_rendered', {
                organization,
                ...analyticsParams,
              });
            }}
          >
            {t('Connect to messaging')}
          </Button>
        </div>
      )}
    </IntegrationFeatures>
  );
}

const IconWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

export default SetupMessagingIntegrationButton;
