import React from 'react';
import DocumentTitle from 'react-document-title';
import {RouteComponentProps} from 'react-router';

import {t} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import ServiceHookSettingsForm from 'app/views/settings/project/serviceHookSettingsForm';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}>;

function ProjectCreateServiceHook({params}: Props) {
  const {orgId, projectId} = params;
  const title = t('Create Service Hook');
  return (
    <DocumentTitle title={`${title} - Sentry`}>
      <React.Fragment>
        <SettingsPageHeader title={title} />
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
