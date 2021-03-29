import React from 'react';
import {RouteComponentProps} from 'react-router';

import {Organization, Project, Team} from 'app/types';
import withTeams from 'app/utils/withTeams';
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
  onChangeTitle: (data: string) => void;
  project: Project;
  teams: Team[];
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

  onRequestSuccess({stateKey, data}) {
    if (stateKey === 'rule' && data.name) {
      this.props.onChangeTitle(data.name);
    }
  }

  handleSubmitSuccess = () => {
    const {router} = this.props;
    const {orgId} = this.props.params;

    router.push(`/organizations/${orgId}/alerts/rules/`);
  };

  renderBody() {
    const {teams} = this.props;
    const {ruleId} = this.props.params;
    const {rule} = this.state;

    const userTeamIds = new Set(teams.filter(({isMember}) => isMember).map(({id}) => id));

    return (
      <RuleForm
        {...this.props}
        ruleId={ruleId}
        rule={rule}
        onSubmitSuccess={this.handleSubmitSuccess}
        userTeamIds={userTeamIds}
      />
    );
  }
}

export default withTeams(IncidentRulesDetails);
