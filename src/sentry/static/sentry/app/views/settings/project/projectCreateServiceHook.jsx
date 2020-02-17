import React from 'react';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import ServiceHookSettingsForm from 'app/views/settings/project/serviceHookSettingsForm';

export default class ProjectCreateServiceHook extends AsyncView {
  renderBody() {
    const {orgId, projectId} = this.props.params;
    return (
      <div className="ref-project-create-service-hook">
        <SettingsPageHeader title={t('Create Service Hook')} />
        <ServiceHookSettingsForm
          {...this.props}
          orgId={orgId}
          projectId={projectId}
          initialData={{events: []}}
        />
      </div>
    );
  }
}
