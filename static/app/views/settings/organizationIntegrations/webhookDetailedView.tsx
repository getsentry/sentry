import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Switch} from '@sentry/scraps/switch';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {IconDelete, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  INSTALLED,
  NOT_INSTALLED,
} from 'sentry/views/settings/organizationIntegrations/constants';
import type {IntegrationTab} from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';
import {IntegrationLayout} from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';

interface WebhookProject {
  enabled: boolean;
  projectId: string;
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
  const queryClient = useQueryClient();
  const {projects: allProjects} = useProjects();

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
          addInstallButton={null}
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
          <WebhookConfigurations
            webhookProjects={webhookProjects}
            allProjects={allProjects}
            organization={organization}
            queryClient={queryClient}
            webhookQueryOptions={webhookQueryOptions}
          />
        )
      }
    />
  );
}

function WebhookConfigurations({
  webhookProjects,
  allProjects,
  organization,
  queryClient,
  webhookQueryOptions,
}: {
  allProjects: ReturnType<typeof useProjects>['projects'];
  organization: Organization;
  queryClient: ReturnType<typeof useQueryClient>;
  webhookProjects: WebhookProject[];
  webhookQueryOptions: {queryKey: readonly unknown[]};
}) {
  if (!webhookProjects.length) {
    return (
      <Panel>
        <EmptyMessage title={t('No projects have webhooks configured')} />
      </Panel>
    );
  }

  return (
    <Fragment>
      {webhookProjects.map(project => (
        <WebhookProjectRow
          key={project.projectId}
          project={project}
          organization={organization}
          allProjects={allProjects}
          queryClient={queryClient}
          webhookQueryOptions={webhookQueryOptions}
        />
      ))}
    </Fragment>
  );
}

function WebhookProjectRow({
  project,
  organization,
  allProjects,
  queryClient,
  webhookQueryOptions,
}: {
  allProjects: ReturnType<typeof useProjects>['projects'];
  organization: Organization;
  project: WebhookProject;
  queryClient: ReturnType<typeof useQueryClient>;
  webhookQueryOptions: {queryKey: readonly unknown[]};
}) {
  const projectAccess = hasEveryAccess(['project:write'], {
    organization,
    project: allProjects.find(p => p.id === project.projectId),
  });

  const toggleMutation = useMutation({
    mutationFn: (shouldEnable: boolean) => {
      addLoadingMessage(shouldEnable ? t('Enabling...') : t('Disabling...'));
      return fetchMutation({
        method: 'POST',
        url: `/projects/${organization.slug}/${project.projectSlug}/legacy-webhooks/`,
        data: {urls: [], enabled: shouldEnable},
      });
    },
    onSuccess: (_data, shouldEnable) => {
      addSuccessMessage(
        shouldEnable ? t('Configuration was enabled.') : t('Configuration was disabled.')
      );
      queryClient.invalidateQueries({queryKey: webhookQueryOptions.queryKey});
    },
    onError: (_error, shouldEnable) => {
      addErrorMessage(
        shouldEnable
          ? t('Unable to enable configuration.')
          : t('Unable to disable configuration.')
      );
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: () => {
      addLoadingMessage(t('Removing...'));
      return fetchMutation({
        method: 'DELETE',
        url: `/projects/${organization.slug}/${project.projectSlug}/legacy-webhooks/`,
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Configuration was removed'));
      queryClient.invalidateQueries({queryKey: webhookQueryOptions.queryKey});
    },
    onError: () => {
      addErrorMessage(t('Unable to remove configuration'));
    },
  });

  const confirmMessage = useMemo(
    () =>
      t(
        'Deleting this installation will disable webhooks for this project and remove any configurations.'
      ),
    []
  );

  return (
    <RowContainer data-test-id="installed-plugin">
      <RowContent>
        <ProjectBox>
          <ProjectBadge
            project={{
              slug: project.projectSlug,
              platform: project.projectPlatform || undefined,
            }}
          />
        </ProjectBox>
        <LinkButton
          variant="transparent"
          icon={<IconSettings />}
          to={`/settings/${organization.slug}/projects/${project.projectSlug}/plugins/webhooks/`}
          data-test-id="integration-configure-button"
        >
          {projectAccess ? t('Configure') : t('View')}
        </LinkButton>
        <Confirm
          priority="danger"
          disabled={!projectAccess}
          confirmText={t('Delete Installation')}
          onConfirm={() => uninstallMutation.mutate()}
          message={confirmMessage}
        >
          <MutedButton
            disabled={!projectAccess}
            variant="transparent"
            icon={<IconDelete />}
            data-test-id="integration-remove-button"
          >
            {t('Uninstall')}
          </MutedButton>
        </Confirm>
        <Switch
          checked={project.enabled}
          onChange={() => toggleMutation.mutate(!project.enabled)}
          disabled={!projectAccess}
        />
      </RowContent>
    </RowContainer>
  );
}

const RowContainer = styled('div')`
  padding: ${p => p.theme.space.xl};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom: none;
  background-color: ${p => p.theme.tokens.background.primary};

  &:last-child {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const RowContent = styled('div')`
  display: flex;
  align-items: center;
`;

const ProjectBox = styled('div')`
  flex: 1 0 fit-content;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  min-width: 0;
`;

const MutedButton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};
`;
