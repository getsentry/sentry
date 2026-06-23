import {Fragment} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {Form} from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {fields} from 'sentry/data/forms/projectAlerts';
import {t, tct} from 'sentry/locale';
import {routeTitleGen} from 'sentry/utils/routeTitle';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectAlertsOutlet} from 'sentry/views/settings/projectAlerts';

export default function ProjectAlertSettings() {
  const organization = useOrganization();
  const {canEditRule, project} = useProjectAlertsOutlet();

  const alertRulesTo = {
    pathname: makeAlertsPathname({path: '/rules/', organization}),
    query: {project: project?.id},
  };

  return (
    <Fragment>
      <SentryDocumentTitle
        title={routeTitleGen(t('Alerts Settings'), project.slug, false)}
      />
      <SettingsPageHeader title={t('Alerts Settings')} />
      <ProjectPermissionAlert project={project} />

      <Flex justify="end" paddingBottom="sm">
        <LinkButton to={alertRulesTo} size="sm">
          {t('View Alert Rules')}
        </LinkButton>
      </Flex>
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
    </Fragment>
  );
}
