import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import memoize from 'lodash/memoize';

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
};

type State = {
  rule: IncidentRule;
  actions: Map<string, any>; // This is temp
} & AsyncView['state'];

class IncidentRulesDetails extends AsyncView<
  RouteComponentProps<RouteParams, {}> & Props,
  State
> {
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

  // XXX(billy): This is temporary, ideally we want actions fetched with triggers?
  onRequestSuccess = async ({data}) => {
    const {orgId, incidentRuleId} = this.props.params;

    // fetch actions for trigger
    this.setState({loading: true});

    try {
      const resp = data.triggers.map(async trigger => {
        const actions = await this.api.requestPromise(
          `/organizations/${orgId}/alert-rules/${incidentRuleId}/triggers/${
            trigger.id
          }/actions/`
        );
        return [trigger.id, actions];
      });

      const actionsTriggersTuples: [string, any][] = await Promise.all(resp);
      this.setState({
        actions: new Map(actionsTriggersTuples),
      });
    } catch (_err) {
      addErrorMessage(t('Unable to fetch actions'));
    }
    this.setState({loading: false});
  };

  getActions = memoize((rule, actions) => {
    const triggers = rule.triggers.map(trigger => ({
      ...trigger,
      actions: actions.get(trigger.id) || [],
    }));

    return {
      ...rule,
      triggers,
    };
  });

  renderBody() {
    const {organization, params} = this.props;
    const {incidentRuleId} = params;
    const {rule} = this.state;

    return (
      <RuleForm
        organization={organization}
        incidentRuleId={incidentRuleId}
        params={params}
        rule={this.getActions(rule, this.state.actions)}
      />
    );
  }
}

export default withOrganization(IncidentRulesDetails);
