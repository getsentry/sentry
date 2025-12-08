import {Fragment} from 'react';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';
import ServiceHookSettingsForm from 'sentry/views/settings/project/serviceHookSettingsForm';

export default function ProjectCreateServiceHook() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const title = t('Create Service Hook');

  return (
    <SentryDocumentTitle title={title}>
      <Fragment>
        <SettingsPageHeader title={title} />
        <ServiceHookSettingsForm
          organization={organization}
          projectId={project.slug}
          initialData={{events: [], isActive: true}}
        />
      </Fragment>
    </SentryDocumentTitle>
  );
}
