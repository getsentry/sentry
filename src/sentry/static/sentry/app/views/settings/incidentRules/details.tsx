import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled, {css} from 'react-emotion';

import {IncidentRule} from 'app/views/settings/incidentRules/constants';
import {Organization, Project} from 'app/types';
import {openModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import RuleForm from 'app/views/settings/incidentRules/ruleForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TriggersList from 'app/views/settings/incidentRules/triggers/list';
import TriggersModal from 'app/views/settings/incidentRules/triggers/modal';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

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
    const {organization, projects} = this.props;

    openModal(
      () => (
        <TriggersModal
          organization={organization}
          projects={projects || []}
          rule={this.state.rule}
        />
      ),
      {dialogClassName: widthCss}
    );
  };

  renderBody() {
    const {orgId, incidentRuleId} = this.props.params;

    return (
      <div>
        <SettingsPageHeader title={t('Edit Incident Rule')} />

        <RuleForm
          saveOnBlur={true}
          orgId={orgId}
          incidentRuleId={incidentRuleId}
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

export default withProjects(withOrganization(IncidentRulesDetails));

const TriggersHeader = styled(SettingsPageHeader)`
  margin: 0;
`;
