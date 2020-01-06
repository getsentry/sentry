import PropTypes from 'prop-types';
import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {IssueAlertRule} from 'app/types/alerts';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import RuleRow from 'app/views/settings/projectAlerts/ruleRow';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import SentryTypes from 'app/sentryTypes';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}>;
type State = {
  ruleList: IssueAlertRule[];
} & AsyncView['state'];

class ProjectAlertRules extends AsyncView<Props, State> {
  static propTypes = {
    routes: PropTypes.array.isRequired,
  };

  static contextTypes = {
    router: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  getEndpoints(): [string, string][] {
    const {orgId, projectId} = this.props.params;
    return [['ruleList', `/projects/${orgId}/${projectId}/rules/`]];
  }

  handleDeleteRule = (rule: IssueAlertRule) => {
    this.setState({
      ruleList: this.state.ruleList.filter(r => r.id !== rule.id),
    });
  };

  renderEmpty() {
    return (
      <Panel>
        <EmptyStateWarning>
          <p>{t('There are no alerts configured for this project.')}</p>
        </EmptyStateWarning>
      </Panel>
    );
  }

  renderResults() {
    const {orgId, projectId} = this.props.params;
    const {organization} = this.context;
    const canEditRule = organization.access.includes('project:write');

    return (
      <div className="rules-list">
        {this.state.ruleList.map(rule => {
          return (
            <RuleRow
              api={this.api}
              key={rule.id}
              data={rule}
              orgId={orgId}
              projectId={projectId}
              params={this.props.params}
              location={this.props.location}
              routes={this.props.routes}
              onDelete={this.handleDeleteRule.bind(this, rule)}
              canEdit={canEditRule}
            />
          );
        })}
      </div>
    );
  }

  renderBody() {
    const {ruleList} = this.state;
    const {projectId} = this.props.params;

    return (
      <React.Fragment>
        <SentryDocumentTitle title={t('Alerts Rules')} objSlug={projectId} />
        <PermissionAlert />
        {!!ruleList.length && this.renderResults()}
        {!ruleList.length && this.renderEmpty()}
      </React.Fragment>
    );
  }
}

export default ProjectAlertRules;
