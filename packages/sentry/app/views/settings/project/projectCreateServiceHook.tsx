import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ServiceHookSettingsForm from 'sentry/views/settings/project/serviceHookSettingsForm';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}>;

function ProjectCreateServiceHook({params}: Props) {
  const {orgId, projectId} = params;
  const title = t('Create Service Hook');

  return (
    <SentryDocumentTitle title={title}>
      <Fragment>
        <SettingsPageHeader title={title} />
        <ServiceHookSettingsForm
          orgId={orgId}
          projectId={projectId}
          initialData={{events: [], isActive: true}}
        />
      </Fragment>
    </SentryDocumentTitle>
  );
}

export default ProjectCreateServiceHook;
