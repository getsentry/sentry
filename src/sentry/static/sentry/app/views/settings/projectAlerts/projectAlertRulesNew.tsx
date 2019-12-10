import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from 'react-emotion';

import {IssueAlertRule} from 'app/types/alerts';
import {Organization} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {SavedIncidentRule} from 'app/views/settings/incidentRules/types';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import RuleRow from 'app/views/settings/projectAlerts/ruleRowNew';
import routeTitle from 'app/utils/routeTitle';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

type Props = {organization: Organization} & RouteComponentProps<
  {
    orgId: string;
    projectId: string;
  },
  {}
> &
  AsyncView['props'];

type State = {
  issueRules: IssueAlertRule[];
  metricRules: SavedIncidentRule[];
} & AsyncView['state'];

class ProjectAlertRules extends AsyncView<Props, State> {
  getEndpoints(): [string, string][] {
    const {orgId, projectId} = this.props.params;
    return [
      ['issueRules', `/projects/${orgId}/${projectId}/rules/`],
      ['metricRules', `/organizations/${orgId}/alert-rules/`],
    ];
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
    const {organization, params} = this.props;
    const {orgId, projectId} = params;
    const canEditRule = organization.access.includes('project:write');

    return (
      <React.Fragment>
        {this.state.issueRules.map(rule => {
          return (
            <RuleRow
              type="issue"
              api={this.api}
              key={rule.id}
              data={rule}
              orgId={orgId}
              projectId={projectId}
              params={this.props.params}
              location={this.props.location}
              routes={this.props.routes}
              canEdit={canEditRule}
            />
          );
        })}

        {this.state.metricRules.map(rule => {
          return (
            <RuleRow
              type="metric"
              api={this.api}
              key={`metric-${rule.id}`}
              data={rule}
              orgId={orgId}
              projectId={projectId}
              params={this.props.params}
              location={this.props.location}
              routes={this.props.routes}
              canEdit={canEditRule}
            />
          );
        })}
      </React.Fragment>
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {loading, issueRules} = this.state;

    return (
      <React.Fragment>
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
              : !!issueRules.length
              ? this.renderResults()
              : this.renderEmpty()}
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}

export default withOrganization(ProjectAlertRules);

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
