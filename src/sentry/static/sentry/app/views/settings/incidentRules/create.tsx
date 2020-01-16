import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Organization, Project} from 'app/types';
import {createDefaultRule} from 'app/views/settings/incidentRules/constants';
import recreateRoute from 'app/utils/recreateRoute';

import RuleForm from './ruleForm';

type RouteParams = {
  orgId: string;
  projectId: string;
  incidentRuleId: string; //TODO(ts): make optional
};

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<RouteParams, {}>;

/**
 * Show metric rules form with an empty rule. Redirects to alerts list after creation.
 */
class IncidentRulesCreate extends React.Component<Props> {
  handleSubmitSuccess = () => {
    const {params, routes, router, location} = this.props;

    router.push(recreateRoute('', {params, routes, location, stepBack: -1}));
  };

  render() {
    const {project, ...props} = this.props;

    return (
      <RuleForm
        onSubmitSuccess={this.handleSubmitSuccess}
        rule={{...createDefaultRule(), projects: [project.slug]}}
        {...props}
      />
    );
  }
}

export default IncidentRulesCreate;
