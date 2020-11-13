import React from 'react';
import {WithRouterProps} from 'react-router';

import {t} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import ServiceHookSettingsForm from 'app/views/settings/project/serviceHookSettingsForm';

type Props = WithRouterProps<{orgId: string; projectId: string}, {}>;

function ProjectCreateServiceHook({params}: Props) {
  const {orgId, projectId} = params;
  return (
    <React.Fragment>
      <SettingsPageHeader title={t('Create Service Hook')} />
      <ServiceHookSettingsForm
        orgId={orgId}
        projectId={projectId}
        initialData={{events: [], isActive: true}}
      />
    </React.Fragment>
  );
}

export default ProjectCreateServiceHook;
