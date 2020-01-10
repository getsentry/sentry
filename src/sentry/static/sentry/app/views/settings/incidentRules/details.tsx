import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {IncidentRule} from 'app/views/settings/incidentRules/types';
import {Organization} from 'app/types';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import RuleForm from 'app/views/settings/incidentRules/ruleForm';
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

  renderBody() {
    const {incidentRuleId} = this.props.params;
    const {rule} = this.state;

    return (
      <RuleForm
        {...this.props}
        incidentRuleId={incidentRuleId}
        rule={rule}
      />
    );
  }
}

export default withOrganization(IncidentRulesDetails);
