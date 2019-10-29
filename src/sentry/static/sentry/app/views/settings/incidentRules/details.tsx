import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {IncidentRule} from 'app/views/settings/incidentRules/types';
import {Organization, Project} from 'app/types';
import AsyncView from 'app/views/asyncView';
import RuleForm from 'app/views/settings/incidentRules/ruleForm';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

type RouteParams = {
  orgId: string;
  projectId: string;
  incidentRuleId: string;
};

type Props = {
  organization: Organization;
  projects: Project[];
};

type State = {
  rule: IncidentRule;
} & AsyncView['state'];

class IncidentRulesDetails extends AsyncView<
  RouteComponentProps<RouteParams, {}> & Props,
  State
> {
  getEndpoints() {
    const {orgId, incidentRuleId} = this.props.params;

    return [
      ['rule', `/organizations/${orgId}/alert-rules/${incidentRuleId}/`] as [
        string,
        string
      ],
    ];
  }

  renderBody() {
    const {organization, params} = this.props;
    const {incidentRuleId} = params;
    const {rule} = this.state;

    return (
      <RuleForm organization={organization} incidentRuleId={incidentRuleId} rule={rule} />
    );
  }
}

export default withProjects(withOrganization(IncidentRulesDetails));
