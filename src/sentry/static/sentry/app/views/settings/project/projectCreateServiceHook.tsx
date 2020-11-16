import React from 'react';
import DocumentTitle from 'react-document-title';
import {RouteComponentProps} from 'react-router/lib/Router';

import {t} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import ServiceHookSettingsForm from 'app/views/settings/project/serviceHookSettingsForm';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}>;

function ProjectCreateServiceHook({params}: Props) {
  const {orgId, projectId} = params;
  return (
    <DocumentTitle title={t('Create Service Hook - Sentry')}>
      <React.Fragment>
        <SettingsPageHeader title={t('Create Service Hook')} />
        <ServiceHookSettingsForm
          orgId={orgId}
          projectId={projectId}
          initialData={{events: [], isActive: true}}
        />
      </React.Fragment>
    </DocumentTitle>
  );
}

export default ProjectCreateServiceHook;
