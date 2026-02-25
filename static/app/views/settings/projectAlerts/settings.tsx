import {Fragment} from 'react';
import {z} from 'zod';

import {AlertLink} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {AutoSaveField, FieldGroup} from '@sentry/scraps/form';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PluginList from 'sentry/components/pluginList';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconMail} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Plugin} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectAlertsOutlet} from 'sentry/views/settings/projectAlerts';

function makeFetchProjectPluginsQueryKey(
  organizationSlug: string,
  projectSlug: string
): ApiQueryKey {
  return [
    getApiUrl(`/projects/$organizationIdOrSlug/$projectIdOrSlug/plugins/`, {
      path: {organizationIdOrSlug: organizationSlug, projectIdOrSlug: projectSlug},
    }),
  ];
}

const alertsSchema = z.object({
  subjectTemplate: z.string(),
  digestsMinDelay: z.number(),
  digestsMaxDelay: z.number(),
});

type AlertsSchema = z.infer<typeof alertsSchema>;

const formatMinutes = (value: number | '') => {
  const minutes = Number(value) / 60;
  return tn('%s minute', '%s minutes', minutes);
};

function getProjectMutationOptions(organizationSlug: string, projectSlug: string) {
  return {
    mutationFn: (data: Partial<AlertsSchema>) =>
      fetchMutation<Project>({
        url: `/projects/${organizationSlug}/${projectSlug}/`,
        method: 'PUT',
        data,
      }),
    onSuccess: (updatedProject: Project) => {
      ProjectsStore.onUpdateSuccess(updatedProject);
    },
  };
}

export default function ProjectAlertSettings() {
  const organization = useOrganization();
  const {canEditRule, project} = useProjectAlertsOutlet();

  const {
    data: pluginList = [],
    isPending: isPluginListLoading,
    isError: isPluginListError,
    refetch: refetchPluginList,
  } = useApiQuery<Plugin[]>(
    makeFetchProjectPluginsQueryKey(organization.slug, project.slug),
    {staleTime: 0, gcTime: 0}
  );

  if (isPluginListError) {
    return <LoadingError onRetry={refetchPluginList} />;
  }

  const projectMutationOptions = getProjectMutationOptions(
    organization.slug,
    project.slug
  );

  return (
    <Fragment>
      <SentryDocumentTitle
        title={routeTitleGen(t('Alerts Settings'), project.slug, false)}
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
          variant="info"
        >
          {t(
            'Looking to fine-tune your personal notification preferences? Visit your Account Settings'
          )}
        </AlertLink>
      </AlertLink.Container>

      {isPluginListLoading ? (
        <LoadingIndicator />
      ) : (
        <Fragment>
          <FieldGroup title={t('Email Settings')}>
            <AutoSaveField
              name="subjectTemplate"
              schema={alertsSchema}
              initialValue={project.subjectTemplate}
              mutationOptions={projectMutationOptions}
            >
              {field => (
                <field.Layout.Row
                  label={t('Subject Template')}
                  hintText={t(
                    'The email subject to use (excluding the prefix) for individual alerts. Usable variables include: $title, $shortID, $projectID, $orgID, and ${tag:key}, such as ${tag:environment} or ${tag:release}.'
                  )}
                >
                  <field.Input
                    value={field.state.value}
                    onChange={e => field.handleChange(e.target.value)}
                    placeholder={t('e.g. $shortID - $title')}
                    disabled={!canEditRule}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveField>
          </FieldGroup>

          <FieldGroup title={t('Digests')}>
            <PanelAlert variant="info">
              {t(
                'Sentry will automatically digest alerts sent by some services to avoid flooding your inbox with individual issue notifications. To control how frequently notifications are delivered, use the sliders below.'
              )}
            </PanelAlert>
            <AutoSaveField
              name="digestsMinDelay"
              schema={alertsSchema}
              initialValue={project.digestsMinDelay}
              mutationOptions={projectMutationOptions}
            >
              {field => (
                <field.Layout.Row
                  label={t('Minimum delivery interval')}
                  hintText={t('Notifications will be delivered at most this often.')}
                >
                  <field.Range
                    value={field.state.value}
                    onChange={field.handleChange}
                    min={60}
                    max={3600}
                    step={60}
                    disabled={!canEditRule}
                    formatLabel={formatMinutes}
                    aria-label={t('Minimum delivery interval')}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveField>

            <AutoSaveField
              name="digestsMaxDelay"
              schema={alertsSchema}
              initialValue={project.digestsMaxDelay}
              mutationOptions={projectMutationOptions}
            >
              {field => (
                <field.Layout.Row
                  label={t('Maximum delivery interval')}
                  hintText={t('Notifications will be delivered at least this often.')}
                >
                  <field.Range
                    value={field.state.value}
                    onChange={field.handleChange}
                    min={60}
                    max={3600}
                    step={60}
                    disabled={!canEditRule}
                    formatLabel={formatMinutes}
                    aria-label={t('Maximum delivery interval')}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveField>
          </FieldGroup>

          {canEditRule && (
            <PluginList
              project={project}
              pluginList={(pluginList ?? []).filter(
                p => p.type === 'notification' && p.hasConfiguration
              )}
            />
          )}
        </Fragment>
      )}
    </Fragment>
  );
}
