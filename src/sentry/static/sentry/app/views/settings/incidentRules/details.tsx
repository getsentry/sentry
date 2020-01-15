import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {IncidentRule} from 'app/views/settings/incidentRules/types';
import {Organization} from 'app/types';
import AsyncView from 'app/views/asyncView';
import RuleForm from 'app/views/settings/incidentRules/ruleForm';
import recreateRoute from 'app/utils/recreateRoute';
import withOrganization from 'app/utils/withOrganization';

type RouteParams = {
  orgId: string;
  projectId: string;
  incidentRuleId: string;
};

type Props = {
  organization: Organization;
} & RouteComponentProps<RouteParams, {}>;

type State = {
  rule: IncidentRule;
  actions: Map<string, any>; // This is temp
} & AsyncView['state'];

class IncidentRulesDetails extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      actions: new Map(),
    };
  }

  getEndpoints() {
    const {orgId, incidentRuleId} = this.props.params;

    return [
      ['rule', `/organizations/${orgId}/alert-rules/${incidentRuleId}/`] as [
        string,
        string
      ],
    ];
  }

  handleSubmitSuccess = () => {
    const {params, routes, router, location} = this.props;

    router.push(recreateRoute('', {params, routes, location, stepBack: -2}));
  };

  renderBody() {
    const {incidentRuleId} = this.props.params;
    const {rule} = this.state;

    return (
      <RuleForm
        {...this.props}
        incidentRuleId={incidentRuleId}
        rule={rule}
        onSubmitSuccess={this.handleSubmitSuccess}
      />
    );
  }
}

export default withOrganization(IncidentRulesDetails);
