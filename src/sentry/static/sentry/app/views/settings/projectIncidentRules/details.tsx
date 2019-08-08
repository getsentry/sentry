import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncView, {AsyncViewState} from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

import RuleForm from './ruleForm';

type IncidentRule = {};

type State = {
  rule: IncidentRule;
} & AsyncViewState;

type RouteParams = {
  orgId: string;
  projectId: string;
  incidentRuleId: string;
};
type Props = RouteComponentProps<RouteParams, {}>;

class IncidentRulesDetails extends AsyncView<Props, State> {
  getEndpoints() {
    const {orgId, projectId, incidentRuleId} = this.props.params;

    return [
      ['rule', `/projects/${orgId}/${projectId}/alert-rules/${incidentRuleId}/`] as [
        string,
        string
      ],
    ];
  }

  handleSubmitSuccess = () => {
    addSuccessMessage(t('Successfully saved Incident Rule'));
  };

  renderBody() {
    const {orgId, projectId, incidentRuleId} = this.props.params;
    return (
      <div>
        <SettingsPageHeader title={t('Edit Incident Rule')} />

        <RuleForm
          orgId={orgId}
          projectId={projectId}
          incidentRuleId={incidentRuleId}
          onSubmitSuccess={this.handleSubmitSuccess}
          initialData={this.state.rule}
        />
      </div>
    );
  }
}

export default IncidentRulesDetails;
