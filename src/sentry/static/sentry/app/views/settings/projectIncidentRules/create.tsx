import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {t} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

import RuleForm from './ruleForm';

type RouteParams = {orgId: string; projectId: string};

class IncidentRulesCreate extends React.Component<RouteComponentProps<RouteParams, {}>> {
  handleSubmitSuccess = data => {
    const {orgId, projectId} = this.props.params;
    this.props.router.push(
      `/settings/${orgId}/projects/${projectId}/incident-rules/${data.id}/`
    );
  };

  render() {
    const {orgId, projectId} = this.props.params;

    return (
      <div>
        <SettingsPageHeader title={t('New Incident Rule')} />
        <RuleForm
          orgId={orgId}
          projectId={projectId}
          onSubmitSuccess={this.handleSubmitSuccess}
        />
      </div>
    );
  }
}

export default IncidentRulesCreate;
