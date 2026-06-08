import {useQuery} from '@tanstack/react-query';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ContextPickerModalContainer as ContextPickerModal} from 'sentry/components/contextPickerModal';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Redirect} from 'sentry/components/redirect';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
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

const WEBHOOK_DESCRIPTION = [
  t('Trigger outgoing HTTP POST requests from Sentry.'),
  t(
    'Note: To configure webhooks over multiple projects, we recommend setting up an Internal Integration.'
  ),
].join('\n\n');

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

export function legacyWebhooksQueryOptions(organization: Organization) {
  return apiOptions.as<OrgLegacyWebhooksResponse>()(
    '/organizations/$organizationIdOrSlug/legacy-webhooks/',
    {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    }
  );
}

export default function WebhookDetailedView() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {openModal} = useModal();

  const tabs: IntegrationTab[] = ['overview', 'configurations'];
  const [activeTab, setActiveTab] = useQueryState(
    'tab',
    parseAsStringLiteral(tabs).withDefault('overview').withOptions({history: 'push'})
  );

  const {data, isPending, isError, refetch} = useQuery(
    legacyWebhooksQueryOptions(organization)
  );

  if (!organization.features.includes('legacy-webhook-ui')) {
    return (
      <Redirect to={normalizeUrl(`/settings/${organization.slug}/plugins/webhooks/`)} />
    );
  }

  const webhookProjects = data?.projects ?? [];
  const installationStatus = webhookProjects.length ? INSTALLED : NOT_INSTALLED;

  function getTabDisplay(tab: IntegrationTab) {
    if (tab === 'configurations') {
      return 'project configurations';
    }
    return 'overview';
  }

  function handleAddToProject() {
    openModal(
      modalProps => (
        <ContextPickerModal
          {...modalProps}
          nextPath={`/settings/${organization.slug}/projects/:projectId/plugins/webhooks/`}
          needProject
          needOrg={false}
          onFinish={to => {
            const path = typeof to === 'string' ? to : (to.pathname ?? '');
            const projectSlug = path.split('/projects/')[1]?.split('/')[0];
            if (projectSlug) {
              fetchMutation({
                method: 'POST',
                url: `/projects/${organization.slug}/${projectSlug}/legacy-webhooks/`,
                data: {enabled: true},
              })
                .then(() => {
                  modalProps.closeModal();
                  navigate(normalizeUrl(to));
                })
                .catch(() => {
                  addErrorMessage(t('Failed to enable webhooks for project.'));
                  modalProps.closeModal();
                });
              return;
            }
            modalProps.closeModal();
            navigate(normalizeUrl(to));
          }}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <IntegrationLayout.Body
      integrationName={t('Webhooks (Legacy)')}
      alert={
        <Alert.Container>
          <Alert variant="warning">
            {tct(
              'We strongly recommend using an [link:internal integration] instead of legacy webhooks.',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/organization/integrations/integration-platform/internal-integration/" />
                ),
              }
            )}
          </Alert>
        </Alert.Container>
      }
      topSection={
        <IntegrationLayout.TopSection
          featureData={WEBHOOK_FEATURE_DATA}
          integrationName={t('Webhooks (Legacy)')}
          installationStatus={installationStatus}
          integrationIcon={<PluginIcon pluginId="webhooks" size={50} />}
          addInstallButton={
            <Button data-test-id="install-button" onClick={handleAddToProject} size="sm">
              {t('Add to Project')}
            </Button>
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
