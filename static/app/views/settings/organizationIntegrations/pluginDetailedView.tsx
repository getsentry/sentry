import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {hasEveryAccess} from 'sentry/components/acl/access';
import ContextPickerModal from 'sentry/components/contextPickerModal';
import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {
  IntegrationInstallationStatus,
  PluginProjectItem,
  PluginWithProjectList,
} from 'sentry/types/integrations';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';
import {
  INSTALLED,
  NOT_INSTALLED,
} from 'sentry/views/settings/organizationIntegrations/constants';
import type {IntegrationTab} from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';
import IntegrationLayout from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';
import {useIntegrationTabs} from 'sentry/views/settings/organizationIntegrations/detailedView/useIntegrationTabs';
import InstalledPlugin from 'sentry/views/settings/organizationIntegrations/installedPlugin';
import RequestIntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationRequest/RequestIntegrationButton';
import PluginDeprecationAlert from 'sentry/views/settings/organizationIntegrations/pluginDeprecationAlert';

function makePluginQueryKey({
  orgSlug,
  pluginSlug,
}: {
  orgSlug: string;
  pluginSlug: string;
}): ApiQueryKey {
  return [`/organizations/${orgSlug}/plugins/configs/`, {query: {plugins: pluginSlug}}];
}

function PluginDetailedView() {
  const tabs: IntegrationTab[] = ['overview', 'configurations'];
  const {activeTab, setActiveTab} = useIntegrationTabs<IntegrationTab>({
    initialTab: 'overview',
  });

  const organization = useOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {integrationSlug} = useParams<{integrationSlug: string}>();

  const {projects} = useProjects();

  const {data: plugins, isPending} = useApiQuery<PluginWithProjectList[]>(
    makePluginQueryKey({orgSlug: organization.slug, pluginSlug: integrationSlug}),
    {staleTime: Infinity, retry: false}
  );

  const integrationType = 'plugin';
  const plugin = useMemo(() => plugins?.[0], [plugins]);
  const description = plugin?.description || '';
  const author = plugin?.author?.name ?? '';
  const installationStatus: IntegrationInstallationStatus = plugin?.projectList?.length
    ? INSTALLED
    : NOT_INSTALLED;
  const integrationName = useMemo(
    () => `${plugin?.name}${plugin?.isHidden ? t(' (Legacy)') : ''}`,
    [plugin]
  );
  const resourceLinks = useMemo(() => plugin?.resourceLinks || [], [plugin]);
  const featureData = useMemo(() => plugin?.featureDescriptions ?? [], [plugin]);

  useEffect(() => {
    if (!isPending && plugin) {
      trackIntegrationAnalytics('integrations.integration_viewed', {
        view: 'integrations_directory_integration_detail',
        integration: integrationSlug,
        integration_type: integrationType,
        already_installed: installationStatus !== 'Not Installed', // pending counts as installed here
        organization,
        integration_tab: activeTab,
      });
    }
  }, [
    isPending,
    integrationSlug,
    plugin,
    activeTab,
    installationStatus,
    organization,
    integrationType,
  ]);

  const getTabDisplay = useCallback((tab: IntegrationTab) => {
    if (tab === 'configurations') {
      return 'project configurations';
    }
    return 'overview';
  }, []);

  const onTabChange = useCallback(
    (tab: IntegrationTab) => {
      setActiveTab(tab);
      trackIntegrationAnalytics('integrations.integration_tab_clicked', {
        view: 'integrations_directory_integration_detail',
        integration: integrationSlug,
        integration_type: integrationType,
        already_installed: installationStatus !== 'Not Installed', // pending counts as installed here
        organization,
        integration_tab: tab,
      });
    },
    [integrationSlug, installationStatus, organization, integrationType, setActiveTab]
  );

  const handleResetConfiguration = useCallback(
    (projectId: string) => {
      if (!plugin) {
        return;
      }
      // make a copy of our project list
      const projectList = plugin.projectList.slice();
      // find the index of the project
      const index = projectList.findIndex(item => item.projectId === projectId);
      // should match but quit if it doesn't
      if (index < 0) {
        return;
      }
      // remove from array
      projectList.splice(index, 1);
      // update state
      const updatedPlugin: PluginWithProjectList = {
        ...plugin,
        projectList,
      };
      setApiQueryData<PluginWithProjectList[]>(
        queryClient,
        makePluginQueryKey({orgSlug: organization.slug, pluginSlug: integrationSlug}),
        existingData => (updatedPlugin ? [updatedPlugin] : existingData)
      );
    },
    [plugin, organization.slug, integrationSlug, queryClient]
  );

  const handlePluginEnableStatus = useCallback(
    (projectId: string, enable = true) => {
      if (!plugin) {
        return;
      }
      // make a copy of our project list
      const projectList = plugin.projectList.slice();
      // find the index of the project
      const index = projectList.findIndex(item => item.projectId === projectId);
      // should match but quit if it doesn't
      if (index < 0) {
        return;
      }

      // update item in array
      projectList[index] = {
        ...projectList[index]!,
        enabled: enable,
      };

      // update state
      const updatedPlugin: PluginWithProjectList = {
        ...plugin,
        projectList,
      };
      setApiQueryData<PluginWithProjectList[]>(
        queryClient,
        makePluginQueryKey({orgSlug: organization.slug, pluginSlug: integrationSlug}),
        existingData => (updatedPlugin ? [updatedPlugin] : existingData)
      );
    },
    [plugin, organization.slug, integrationSlug, queryClient]
  );

  const handleAddToProject = useCallback(() => {
    if (!plugin) {
      return;
    }
    trackIntegrationAnalytics('integrations.plugin_add_to_project_clicked', {
      view: 'integrations_directory_integration_detail',
      integration: integrationSlug,
      integration_type: integrationType,
      already_installed: installationStatus !== 'Not Installed', // pending counts as installed here
      organization,
    });
    openModal(
      modalProps => (
        <ContextPickerModal
          {...modalProps}
          nextPath={`/settings/${organization.slug}/projects/:projectId/plugins/${plugin.id}/`}
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
  }, [integrationSlug, installationStatus, navigate, organization, plugin]);

  const renderTopButton = useCallback(
    (disabledFromFeatures: boolean, userHasAccess: boolean) => {
      if (userHasAccess) {
        return (
          <AddButton
            data-test-id="install-button"
            disabled={disabledFromFeatures}
            onClick={handleAddToProject}
            size="sm"
            priority="primary"
          >
            {t('Add to Project')}
          </AddButton>
        );
      }
      return (
        <RequestIntegrationButton
          name={integrationName}
          slug={integrationSlug}
          type={integrationType}
        />
      );
    },
    [handleAddToProject, integrationName, integrationSlug, integrationType]
  );
  const renderDeprecatedButton = useCallback(() => {
    return (
      <Tooltip
        title={t(
          'This Plugin is deprecated and not available to install on new projects.'
        )}
        isHoverable
      >
        <Button disabled>Add to Project</Button>
      </Tooltip>
    );
  }, []);

  const renderConfigurations = useCallback(() => {
    if (plugin?.projectList.length) {
      return (
        <Fragment>
          <PluginDeprecationAlert organization={organization} plugin={plugin} />
          <div>
            {plugin.projectList.map((projectItem: PluginProjectItem) => (
              <InstalledPlugin
                key={projectItem.projectId}
                organization={organization}
                plugin={plugin}
                hasAccess={hasEveryAccess(['project:write'], {
                  organization,
                  project: projects.find(p => p.id === projectItem.projectId.toString()),
                })}
                projectItem={projectItem}
                onResetConfiguration={handleResetConfiguration}
                onPluginEnableStatusChange={handlePluginEnableStatus}
                trackIntegrationAnalytics={eventKey => {
                  trackIntegrationAnalytics(eventKey, {
                    view: 'integrations_directory_integration_detail',
                    integration: integrationSlug,
                    integration_type: integrationType,
                    already_installed: installationStatus !== 'Not Installed', // pending counts as installed here
                    organization,
                  });
                }}
              />
            ))}
          </div>
        </Fragment>
      );
    }
    return null;
  }, [
    handlePluginEnableStatus,
    handleResetConfiguration,
    installationStatus,
    integrationSlug,
    integrationType,
    organization,
    plugin,
    projects,
  ]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (!plugin) {
    return <LoadingError message={t('There was an error loading this integration.')} />;
  }

  return (
    <IntegrationLayout.Body
      integrationName={integrationName}
      alert={null}
      topSection={
        <IntegrationLayout.TopSection
          featureData={featureData}
          integrationName={integrationName}
          installationStatus={installationStatus}
          integrationIcon={<PluginIcon pluginId={integrationSlug} size={50} />}
          addInstallButton={
            <IntegrationLayout.AddInstallButton
              featureData={featureData}
              hideButtonIfDisabled={false}
              requiresAccess={false}
              renderTopButton={
                // TODO @sentaur-athena: remove this once we have a solution to deprecate the heroku plugin
                plugin.id === 'heroku' ? renderTopButton : renderDeprecatedButton
              }
            />
          }
          additionalCTA={null}
        />
      }
      tabs={
        <IntegrationLayout.Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          getTabDisplay={getTabDisplay}
        />
      }
      content={
        activeTab === 'overview' ? (
          <IntegrationLayout.InformationCard
            integrationSlug={integrationSlug}
            description={description}
            featureData={featureData}
            author={author}
            resourceLinks={resourceLinks}
            permissions={null}
          />
        ) : (
          renderConfigurations()
        )
      }
    />
  );
}

const AddButton = styled(Button)`
  margin-bottom: ${space(1)};
`;

export default withOrganization(PluginDetailedView);
