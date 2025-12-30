import {Fragment} from 'react';

import {AlertLink} from 'sentry/components/core/alert/alertLink';
import {LinkButton} from 'sentry/components/core/button/linkButton';
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
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
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
  return [`/projects/${organizationSlug}/${projectSlug}/plugins/`];
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
              fields={[fields.subjectTemplate]}
            />

            <JsonForm
              title={t('Digests')}
              disabled={!canEditRule}
              fields={[fields.digestsMinDelay, fields.digestsMaxDelay]}
              renderHeader={() => (
                <PanelAlert variant="info">
                  {t(
                    'Sentry will automatically digest alerts sent by some services to avoid flooding your inbox with individual issue notifications. To control how frequently notifications are delivered, use the sliders below.'
                  )}
                </PanelAlert>
              )}
            />
          </Form>

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
