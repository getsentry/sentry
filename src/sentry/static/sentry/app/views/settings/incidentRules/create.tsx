import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Organization, Project} from 'app/types';
import {createDefaultRule} from 'app/views/settings/incidentRules/constants';
import recreateRoute from 'app/utils/recreateRoute';

import RuleForm from './ruleForm';

type Props = {
  organization: Organization;
  project: Project;
};

/**
 * Show metric rules form with an empty rule. Redirects to alerts list after creation.
 */
class IncidentRulesCreate extends React.Component<RouteComponentProps<{}, {}> & Props> {
  handleSubmitSuccess = () => {
    const {params, routes, router, location} = this.props;

    router.push(recreateRoute('metric-rules/', {params, routes, location, stepBack: -1}));
  };

  render() {
    const {organization, project} = this.props;

    return (
      <RuleForm
        organization={organization}
        onSubmitSuccess={this.handleSubmitSuccess}
        rule={{...createDefaultRule(), projects: [project.slug]}}
        params={this.props.params}
      />
    );
  }
}

export default IncidentRulesCreate;
