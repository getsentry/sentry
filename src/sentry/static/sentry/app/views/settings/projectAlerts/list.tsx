import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import {IconAdd} from 'app/icons';
import {IssueAlertRule} from 'app/types/alerts';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {SavedIncidentRule} from 'app/views/settings/incidentRules/types';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import RuleRow from 'app/views/settings/projectAlerts/ruleRow';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Tooltip from 'app/components/tooltip';
import routeTitle from 'app/utils/routeTitle';
import space from 'app/styles/space';

type Props = {canEditRule: boolean} & RouteComponentProps<
  {
    orgId: string;
    projectId: string;
  },
  {}
>;

type State = {
  rules: Array<
    ({type: 'alert_rule'} & IssueAlertRule) | ({type: 'rule'} & SavedIncidentRule)
  >;
} & AsyncView['state'];

class ProjectAlertRules extends AsyncView<Props, State> {
  getEndpoints(): [string, string][] {
    const {orgId, projectId} = this.props.params;
    return [['rules', `/projects/${orgId}/${projectId}/combined-rules/`]];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitle(t('Alert Rules'), projectId);
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('There are no alerts configured for this project.')}</p>
      </EmptyStateWarning>
    );
  }

  renderResults() {
    const {canEditRule, params} = this.props;
    const {orgId, projectId} = params;

    return (
      <React.Fragment>
        {this.state.rules.map(rule => (
          <RuleRow
            type={rule.type === 'alert_rule' ? 'issue' : 'metric'}
            api={this.api}
            key={`${rule.type}-${rule.id}`}
            data={rule}
            orgId={orgId}
            projectId={projectId}
            params={this.props.params}
            location={this.props.location}
            routes={this.props.routes}
            canEdit={canEditRule}
          />
        ))}
      </React.Fragment>
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {canEditRule, params} = this.props;
    const {orgId, projectId} = params;
    const {loading, rules} = this.state;

    const basePath = `/settings/${orgId}/projects/${projectId}/alerts/`;

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Alerts')}
          action={
            <HeaderActions>
              <Button to={`${basePath}settings/`} size="small" icon="icon-settings">
                {t('Settings')}
              </Button>
              <Tooltip
                disabled={canEditRule}
                title={t('You do not have permission to edit alert rules.')}
              >
                <Button
                  to={`${basePath}new/`}
                  disabled={!canEditRule}
                  priority="primary"
                  size="small"
                  icon={<IconAdd size="xs" circle />}
                >
                  {t('New Alert Rule')}
                </Button>
              </Tooltip>
            </HeaderActions>
          }
        />
        <PermissionAlert />

        <Panel>
          <RuleHeader>
            <div>{t('Type')}</div>
            <div>{t('Name')}</div>
            <TriggerAndActions>
              <div>{t('Conditions/Triggers')}</div>
              <div>{t('Action(s)')}</div>
            </TriggerAndActions>
          </RuleHeader>

          <PanelBody>
            {loading
              ? super.renderLoading()
              : !!rules.length
              ? this.renderResults()
              : this.renderEmpty()}
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}

export default ProjectAlertRules;

const RuleHeader = styled(PanelHeader)`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: 1fr 3fr 6fr;
  grid-auto-flow: column;
`;

const TriggerAndActions = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-flow: column;
`;

const HeaderActions = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
`;
