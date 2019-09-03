import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled, {css} from 'react-emotion';

import {Organization, Project} from 'app/types';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import {openModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TriggerForm from 'app/views/settings/incidentRules/triggers/form';
import TriggersList from 'app/views/settings/incidentRules/triggers/list';

import {IncidentRule} from './types';
import RuleForm from './ruleForm';

type State = {
  rule: IncidentRule;
} & AsyncView['state'];

type RouteParams = {
  orgId: string;
  incidentRuleId: string;
};

type Props = {
  organization: Organization;
  projects: Project[];
};

const widthCss = css`
  width: 80%;
  margin-left: -40%;
`;

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

  handleNewTrigger = () => {
    const {organization, projects, params} = this.props;
    const {orgId} = params;
    openModal(
      () => (
        <div>
          <h3>
            Trigger for:
            {this.state.rule.name}
          </h3>
          <TriggerForm
            organization={organization}
            projects={projects || []}
            orgId={orgId}
            onSubmitSuccess={this.handleSubmitSuccess}
          />
        </div>
      ),
      {dialogClassName: widthCss}
    );
  };

  handleSubmitSuccess = () => {
    addSuccessMessage(t('Successfully saved Incident Rule'));
  };

  renderBody() {
    const {orgId, incidentRuleId} = this.props.params;
    if (!this.state.rule) {
      return null;
    }
    return (
      <div>
        <SettingsPageHeader title={t('Edit Incident Rule')} />

        <RuleForm
          saveOnBlur={true}
          orgId={orgId}
          incidentRuleId={incidentRuleId}
          onSubmitSuccess={this.handleSubmitSuccess}
          initialData={this.state.rule}
        />

        <TriggersHeader
          title={t('Triggers')}
          action={
            <Button
              size="small"
              priority="primary"
              icon="icon-circle-add"
              disabled={!this.state.rule}
              onClick={this.handleNewTrigger}
            >
              {t('New Trigger')}
            </Button>
          }
        />

        <TriggersList />
      </div>
    );
  }
}

export default IncidentRulesDetails;

const TriggersHeader = styled(SettingsPageHeader)`
  margin: 0;
`;
