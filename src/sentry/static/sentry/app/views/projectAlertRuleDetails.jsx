import React from 'react';

import SentryTypes from '../proptypes';
import AsyncView from './asyncView';
import RuleEditor from './ruleEditor';

class ProjectAlertRuleDetails extends AsyncView {
  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  getEndpoints() {
    let {orgId, projectId} = this.props.params;

    return [['configs', `/projects/${orgId}/${projectId}/rules/configuration/`]];
  }

  renderBody() {
    let {organization, project} = this.context;
    let {actions, conditions} = this.state.configs;

    return (
      <RuleEditor
        organization={organization}
        project={project}
        actions={actions}
        conditions={conditions}
        params={this.props.params}
      />
    );
  }
}

export default ProjectAlertRuleDetails;
