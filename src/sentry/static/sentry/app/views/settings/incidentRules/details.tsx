import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Organization} from 'app/types';
import AsyncView from 'app/views/asyncView';
import RuleForm from 'app/views/settings/incidentRules/ruleForm';
import {IncidentRule} from 'app/views/settings/incidentRules/types';

type RouteParams = {
  orgId: string;
  projectId: string;
  ruleId: string;
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

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId, ruleId} = this.props.params;

    return [['rule', `/organizations/${orgId}/alert-rules/${ruleId}/`]];
  }

  handleSubmitSuccess = () => {
    const {router} = this.props;
    const {orgId} = this.props.params;

    router.push(`/organizations/${orgId}/alerts/rules/`);
  };

  renderBody() {
    const {ruleId} = this.props.params;
    const {rule} = this.state;

    return (
      <RuleForm
        {...this.props}
        ruleId={ruleId}
        rule={rule}
        onSubmitSuccess={this.handleSubmitSuccess}
      />
    );
  }
}

export default IncidentRulesDetails;
