import {Fragment} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {Form} from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {PluginList} from 'sentry/components/pluginList';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {fields} from 'sentry/data/forms/projectAlerts';
import {t, tct} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import {routeTitleGen} from 'sentry/utils/routeTitle';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectAlertsOutlet} from 'sentry/views/settings/projectAlerts';

function makeFetchProjectPluginsQueryKey(
  organizationSlug: string,
  projectSlug: string
): ApiQueryKey {
  return [
    getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/plugins/', {
      path: {organizationIdOrSlug: organizationSlug, projectIdOrSlug: projectSlug},
    }),
  ];
}

export default function ProjectAlertSettings() {
  const organization = useOrganization();
  const {canEditRule, project} = useProjectAlertsOutlet();
  const hasPageFrameFeature = useHasPageFrameFeature();

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

  const alertRulesTo = {
    pathname: makeAlertsPathname({path: '/rules/', organization}),
    query: {project: project?.id},
  };

  return (
    <Fragment>
      <SentryDocumentTitle
        title={routeTitleGen(t('Alerts Settings'), project.slug, false)}
      />
      <SettingsPageHeader
        title={t('Alerts Settings')}
        action={
          !hasPageFrameFeature && (
            <LinkButton to={alertRulesTo} size="sm">
              {t('View Alert Rules')}
            </LinkButton>
          )
        }
      />
      <ProjectPermissionAlert project={project} />

      {isPluginListLoading ? (
        <LoadingIndicator />
      ) : (
        <Fragment>
          {hasPageFrameFeature && (
            <Flex justify="end" paddingBottom="sm">
              <LinkButton to={alertRulesTo} size="sm">
                {t('View Alert Rules')}
              </LinkButton>
            </Flex>
          )}
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
              renderHeader={() => (
                <PanelAlert variant="info">
                  {tct(
                    'Looking to fine-tune your personal notification preferences? Visit your [link:Account Settings].',
                    {link: <Link to="/settings/account/notifications/" />}
                  )}
                </PanelAlert>
              )}
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
