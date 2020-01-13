import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {IncidentRule} from 'app/views/settings/incidentRules/types';
import {Organization} from 'app/types';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
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

  getActions = (rule, actions) => {
    const triggers = rule.triggers.map(trigger => ({
      ...trigger,
      actions: actions.get(trigger.id) || [],
    }));

    return {
      ...rule,
      triggers,
    };
  };

  renderBody() {
    const {incidentRuleId} = this.props.params;
    const {rule} = this.state;

    return (
      <RuleForm
        {...this.props}
        incidentRuleId={incidentRuleId}
        rule={this.getActions(rule, this.state.actions)}
        onSubmitSuccess={this.handleSubmitSuccess}
      />
    );
  }
}

export default withOrganization(IncidentRulesDetails);
