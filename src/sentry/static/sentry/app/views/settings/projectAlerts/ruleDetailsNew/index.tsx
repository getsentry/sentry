import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {
  IssueAlertRuleActionTemplate,
  IssueAlertRuleConditionTemplate,
} from 'app/types/alerts';
import {Organization, Project} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import IssueEditor from 'app/views/settings/projectAlerts/issueEditor';
import IncidentRulesCreate from 'app/views/settings/incidentRules/create';
import PanelItem from 'app/components/panels/panelItem';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

type RouteParams = {
  orgId: string;
  projectId: string;
  incidentRuleId: string;
  ruleId: string; //TODO(ts): Make ruleId optional
};

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<RouteParams, {}>;

type State = {
  alertType: string | null;
  configs: {
    actions: IssueAlertRuleActionTemplate[];
    conditions: IssueAlertRuleConditionTemplate[];
  } | null;
} & AsyncView['state'];

class RuleDetails extends AsyncView<Props, State> {
  getDefaultState() {
    const {pathname} = this.props.location;

    return {
      ...super.getDefaultState(),
      alertType: pathname.includes('issue-rules')
        ? 'issue'
        : pathname.includes('metric-rules')
        ? 'metric'
        : null,
      configs: null,
    };
  }

  getEndpoints(): [string, string][] {
    const {orgId, projectId} = this.props.params;

    return [['configs', `/projects/${orgId}/${projectId}/rules/configuration/`]];
  }

  handleChangeAlertType = (alertType: string) => {
    // alertType should be `issue` or `metric`
    this.setState({
      alertType,
    });
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {alertType, configs} = this.state;
    return (
      <React.Fragment>
        <Panel>
          <PanelHeader>{t('Choose an Alert Type')}</PanelHeader>
          <PanelBody>
            <PanelItem>
              <RadioGroup
                label={t('Select an Alert Type')}
                value={this.state.alertType}
                choices={[
                  [
                    'metric',
                    t('Metric Alert'),
                    t(
                      'Metric alerts allow you to filter and set thresholds on errors. They can be used for high-level monitoring of patterns, or fine-grained monitoring of individual events.'
                    ),
                  ],
                  [
                    'issue',
                    t('Issue Alert'),
                    t(
                      'Issue alerts fire whenever any issue in the project matches your specified criteria, such as a resolved issue re-appearing or an issue affecting many users.'
                    ),
                  ],
                ]}
                onChange={this.handleChangeAlertType}
              />
            </PanelItem>
          </PanelBody>
        </Panel>

        {alertType === 'issue' ? (
          <IssueEditor
            {...this.props}
            actions={configs && configs.actions}
            conditions={configs && configs.conditions}
          />
        ) : alertType === 'metric' ? (
          <IncidentRulesCreate {...this.props} />
        ) : null}
      </React.Fragment>
    );
  }
}

export default withProject(withOrganization(RuleDetails));
