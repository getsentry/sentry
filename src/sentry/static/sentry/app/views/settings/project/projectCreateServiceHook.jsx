import React from 'react';

import {t} from '../../../locale';
import AsyncView from '../../asyncView';
import SettingsPageHeader from '../components/settingsPageHeader';

import ServiceHookSettingsForm from './serviceHookSettingsForm';

export default class ProjectCreateServiceHook extends AsyncView {
  renderBody() {
    let {orgId, projectId} = this.props.params;
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
