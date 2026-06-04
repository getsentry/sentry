import {useCallback} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {useModal} from '@sentry/scraps/modal';

import {ContextPickerModalContainer as ContextPickerModal} from 'sentry/components/contextPickerModal';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {PlatformKey} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  INSTALLED,
  NOT_INSTALLED,
} from 'sentry/views/settings/organizationIntegrations/constants';
import type {IntegrationTab} from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';
import {IntegrationLayout} from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';
import {WebhookConfigurations} from 'sentry/views/settings/organizationIntegrations/webhookConfigurations';

export interface WebhookProject {
  enabled: boolean;
  projectId: number;
  projectName: string;
  projectPlatform: PlatformKey;
  projectSlug: string;
}

interface OrgLegacyWebhooksResponse {
  projects: WebhookProject[];
}

const WEBHOOK_DESCRIPTION = t(
  'Trigger outgoing HTTP POST requests from Sentry.\n\nNote: To configure webhooks over multiple projects, we recommend setting up an Internal Integration.'
);

const WEBHOOK_FEATURE_DATA = [
  {
    description: t('Configure rule based outgoing HTTP POST requests from Sentry.'),
    featureGate: 'alert-rule',
    featureId: 1,
  },
];

const WEBHOOK_RESOURCE_LINKS = [
  {
    title: 'Internal Integrations',
    url: 'https://docs.sentry.io/organization/integrations/integration-platform/internal-integration/',
  },
];

export function WebhookDetailedView() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {openModal} = useModal();

  const tabs: IntegrationTab[] = ['overview', 'configurations'];
  const [activeTab, setActiveTab] = useQueryState(
    'tab',
    parseAsStringLiteral(tabs).withDefault('overview').withOptions({history: 'push'})
  );

  const webhookQueryOptions = apiOptions.as<OrgLegacyWebhooksResponse>()(
    '/organizations/$organizationIdOrSlug/legacy-webhooks/',
    {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    }
  );

  const {data, isPending, isError, refetch} = useQuery(webhookQueryOptions);

  const webhookProjects = data?.projects ?? [];
  const installationStatus = webhookProjects.length ? INSTALLED : NOT_INSTALLED;

  const getTabDisplay = useCallback((tab: IntegrationTab) => {
    if (tab === 'configurations') {
      return 'project configurations';
    }
    return 'overview';
  }, []);

  const handleAddToProject = useCallback(() => {
    openModal(
      modalProps => (
        <ContextPickerModal
          {...modalProps}
          nextPath={`/settings/${organization.slug}/projects/:projectId/plugins/webhooks/`}
          needProject
          needOrg={false}
          onFinish={to => {
            modalProps.closeModal();
            navigate(normalizeUrl(to));
          }}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }, [navigate, organization.slug, openModal]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <IntegrationLayout.Body
      integrationName={t('Webhooks')}
      alert={null}
      topSection={
        <IntegrationLayout.TopSection
          featureData={WEBHOOK_FEATURE_DATA}
          integrationName={t('Webhooks')}
          installationStatus={installationStatus}
          integrationIcon={<PluginIcon pluginId="webhooks" size={50} />}
          addInstallButton={
            <AddButton
              data-test-id="install-button"
              onClick={handleAddToProject}
              size="sm"
            >
              {t('Add to Project')}
            </AddButton>
          }
          additionalCTA={null}
        />
      }
      tabs={
        <IntegrationLayout.Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          getTabDisplay={getTabDisplay}
        />
      }
      content={
        activeTab === 'overview' ? (
          <IntegrationLayout.InformationCard
            integrationSlug="webhooks"
            description={WEBHOOK_DESCRIPTION}
            featureData={WEBHOOK_FEATURE_DATA}
            author={t('Sentry Team')}
            resourceLinks={WEBHOOK_RESOURCE_LINKS}
            permissions={null}
          />
        ) : (
          <WebhookConfigurations webhookProjects={webhookProjects} />
        )
      }
    />
  );
}

const AddButton = styled(Button)`
  margin-bottom: ${p => p.theme.space.md};
`;
