import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {AlertRuleAggregations} from 'app/views/settings/incidentRules/types';
import {Organization, Project} from 'app/types';
import recreateRoute from 'app/utils/recreateRoute';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

import RuleForm from './ruleForm';

const DEFAULT_METRIC = [AlertRuleAggregations.TOTAL];
const DEFAULT_RULE = {
  aggregations: DEFAULT_METRIC,
  query: '',
  timeWindow: 60,
  triggers: [],
};

type Props = {
  organization: Organization;
  project: Project;
};

class IncidentRulesCreate extends React.Component<RouteComponentProps<{}, {}> & Props> {
  handleSubmitSuccess = data => {
    const {params, routes, router, location} = this.props;

    router.push(recreateRoute(`${data.id}/`, {params, routes, location, stepBack: -1}));
  };

  render() {
    const {organization, project} = this.props;

    return (
      <RuleForm
        organization={organization}
        onSubmitSuccess={this.handleSubmitSuccess}
        rule={{...DEFAULT_RULE, projects: [project.slug]}}
      />
    );
  }
}

export default withOrganization(withProject(IncidentRulesCreate));
