import {useQueries, useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {openModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {
  IntegrationProvider,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getIntegrationFeatureGate} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MessagingIntegrationModal} from 'sentry/views/alerts/rules/issue/messagingIntegrationModal';

export enum MessagingIntegrationAnalyticsView {
  ALERT_RULE_CREATION = 'alert_rule_creation_messaging_integration_onboarding',
  PROJECT_CREATION = 'project_creation_messaging_integration_onboarding',
}

type Props = {
  analyticsView: MessagingIntegrationAnalyticsView;
  projectId?: string;
  refetchConfigs?: () => void;
};

export function SetupMessagingIntegrationButton({
  refetchConfigs,
  analyticsView,
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

  const messagingIntegrationsQuery = useQuery(
    apiOptions.as<OrganizationIntegration[]>()(
      '/organizations/$organizationIdOrSlug/integrations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {integrationType: 'messaging'},
        staleTime: Infinity,
      }
    )
  );

  const integrationProvidersQuery = useQueries({
    queries: providerKeys.map((providerKey: string) =>
      apiOptions.as<{providers: IntegrationProvider[]}>()(
        '/organizations/$organizationIdOrSlug/config/integrations/',
        {
          path: {organizationIdOrSlug: organization.slug},
          query: {provider_key: providerKey},
          staleTime: Infinity,
        }
      )
    ),
    combine: results => ({
      providers: results
        .map(r => r.data?.providers[0])
        .filter((p): p is IntegrationProvider => p !== undefined),
      isPending: results.some(r => r.isPending),
      isError: results.some(r => r.isError),
    }),
  });

  const {IntegrationFeatures} = getIntegrationFeatureGate();

  const shouldRenderSetupButton = messagingIntegrationsQuery.data?.every(
    integration => integration.status !== 'active'
  );

  if (
    messagingIntegrationsQuery.isPending ||
    messagingIntegrationsQuery.isError ||
    integrationProvidersQuery.isPending ||
    integrationProvidersQuery.isError ||
    integrationProvidersQuery.providers.length === 0
  ) {
    return null;
  }

  if (!shouldRenderSetupButton) {
    return null;
  }

  return (
    <IntegrationFeatures
      organization={organization}
      features={integrationProvidersQuery.providers[0]!.metadata?.features}
    >
      {({disabled, disabledReason}) => (
        <div>
          <Button
            size="sm"
            icon={
              <Flex gap="md">
                {providerKeys.map((value: string) => {
                  return <PluginIcon key={value} pluginId={value} size={16} />;
                })}
              </Flex>
            }
            disabled={disabled}
            tooltipProps={{
              title: disabled
                ? disabledReason
                : t(
                    'Send alerts to your messaging service. Install the integration now.'
                  ),
            }}
            onClick={() => {
              openModal(
                deps => (
                  <MessagingIntegrationModal
                    {...deps}
                    headerContent={t('Connect with a messaging tool')}
                    bodyContent={t('Receive alerts and digests right where you work.')}
                    providers={integrationProvidersQuery.providers}
                    onAddIntegration={onAddIntegration}
                    {...(projectId && {modalParams: {projectId}})}
                    analyticsView={analyticsView}
                  />
                ),
                {
                  closeEvents: 'escape-key',
                }
              );
            }}
          >
            {t('Connect to messaging')}
          </Button>
        </div>
      )}
    </IntegrationFeatures>
  );
}
