import React from 'react';

import SentryTypes from 'app/proptypes';
import AsyncView from 'app/views/asyncView';
import RuleEditor from 'app/views/settings/projectAlerts/ruleEditor';

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
        routes={this.props.routes}
      />
    );
  }
}

export default ProjectAlertRuleDetails;
