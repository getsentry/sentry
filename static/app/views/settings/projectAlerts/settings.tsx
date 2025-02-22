import {Fragment} from 'react';

import {LinkButton} from 'sentry/components/button';
import {AlertLink} from 'sentry/components/core/alertLink';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PluginList from 'sentry/components/pluginList';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {fields} from 'sentry/data/forms/projectAlerts';
import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Project} from 'sentry/types/project';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

interface ProjectAlertSettingsProps extends RouteComponentProps<{projectId: string}> {
  canEditRule: boolean;
}

function makeFetchProjectPluginsQueryKey(
  organizationSlug: string,
  projectSlug: string
): ApiQueryKey {
  return [`/projects/${organizationSlug}/${projectSlug}/plugins/`];
}

function ProjectAlertSettings({canEditRule, params}: ProjectAlertSettingsProps) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const projectSlug = params.projectId;
  const {
    data: project,
    isPending: isProjectLoading,
    isError: isProjectError,
    refetch: refetchProject,
  } = useApiQuery<Project>([`/projects/${organization.slug}/${projectSlug}/`], {
    staleTime: 0,
    gcTime: 0,
  });
  const {
    data: pluginList = [],
    isPending: isPluginListLoading,
    isError: isPluginListError,
    refetch: refetchPluginList,
  } = useApiQuery<Plugin[]>(
    makeFetchProjectPluginsQueryKey(organization.slug, projectSlug),
    {staleTime: 0, gcTime: 0}
  );

  if ((!isProjectLoading && !project) || isPluginListError || isProjectError) {
    return (
      <LoadingError
        onRetry={() => {
          if (isProjectError) {
            refetchProject();
          }
          if (isPluginListError) {
            refetchPluginList();
          }
        }}
      />
    );
  }

  const updatePlugin = (plugin: Plugin, enabled: boolean) => {
    setApiQueryData<Plugin[]>(
      queryClient,
      makeFetchProjectPluginsQueryKey(organization.slug, projectSlug),
      oldState =>
        oldState.map(p => {
          if (p.id !== plugin.id) {
            return p;
          }
          return {
            ...plugin,
            enabled,
          };
        })
    );
  };

  const handleEnablePlugin = (plugin: Plugin) => {
    updatePlugin(plugin, true);
  };

  const handleDisablePlugin = (plugin: Plugin) => {
    updatePlugin(plugin, false);
  };

  return (
    <Fragment>
      <SentryDocumentTitle
        title={routeTitleGen(t('Alerts Settings'), projectSlug, false)}
      />
      <SettingsPageHeader
        title={t('Alerts Settings')}
        action={
          <LinkButton
            to={{
              pathname: makeAlertsPathname({
                path: `/rules/`,
                organization,
              }),
              query: {project: project?.id},
            }}
            size="sm"
          >
            {t('View Alert Rules')}
          </LinkButton>
        }
      />
      <ProjectPermissionAlert project={project} />
      <AlertLink.Container>
        <AlertLink
          to="/settings/account/notifications/"
          trailingItems={<IconMail />}
          type="info"
        >
          {t(
            'Looking to fine-tune your personal notification preferences? Visit your Account Settings'
          )}
        </AlertLink>
      </AlertLink.Container>

      {isProjectLoading || isPluginListLoading ? (
        <LoadingIndicator />
      ) : (
        <Fragment>
          <Form
            saveOnBlur
            allowUndo
            initialData={{
              subjectTemplate: project.subjectTemplate,
              digestsMinDelay: project.digestsMinDelay,
              digestsMaxDelay: project.digestsMaxDelay,
            }}
            apiMethod="PUT"
            apiEndpoint={`/projects/${organization.slug}/${project.slug}/`}
          >
            <JsonForm
              disabled={!canEditRule}
              title={t('Email Settings')}
              fields={[fields.subjectTemplate!]}
            />

            <JsonForm
              title={t('Digests')}
              disabled={!canEditRule}
              fields={[fields.digestsMinDelay!, fields.digestsMaxDelay!]}
              renderHeader={() => (
                <PanelAlert type="info">
                  {t(
                    'Sentry will automatically digest alerts sent by some services to avoid flooding your inbox with individual issue notifications. To control how frequently notifications are delivered, use the sliders below.'
                  )}
                </PanelAlert>
              )}
            />
          </Form>

          {canEditRule && (
            <PluginList
              organization={organization}
              project={project}
              pluginList={(pluginList ?? []).filter(
                p => p.type === 'notification' && p.hasConfiguration
              )}
              onEnablePlugin={handleEnablePlugin}
              onDisablePlugin={handleDisablePlugin}
            />
          )}
        </Fragment>
      )}
    </Fragment>
  );
}

export default ProjectAlertSettings;
