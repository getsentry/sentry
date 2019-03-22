import {Flex} from 'grid-emotion';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {
  addSuccessMessage,
  addErrorMessage,
  addLoadingMessage,
  removeIndicator,
} from 'app/actionCreators/indicator';
import {conditionalGuideAnchor} from 'app/components/assistant/guideAnchor';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import Duration from 'app/components/duration';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import EnvironmentStore from 'app/stores/environmentStore';
import ListLink from 'app/components/listLink';
import NavTabs from 'app/components/navTabs';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Tooltip from 'app/components/tooltip';
import recreateRoute from 'app/utils/recreateRoute';
import withApi from 'app/utils/withApi';

const TextColorLink = styled(Link)`
  color: ${p => p.theme.gray3};
`;

const RuleDescriptionRow = styled.div`
  display: flex;
`;
const RuleDescriptionColumn = styled.div`
  flex: 1;
  padding: ${p => p.theme.grid * 2}px;
  height: 100%;
`;
const Condition = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
`;

const RuleRow = withApi(
  class RuleRow extends React.Component {
    static propTypes = {
      api: PropTypes.object.isRequired,
      orgId: PropTypes.string.isRequired,
      projectId: PropTypes.string.isRequired,
      data: PropTypes.object.isRequired,
      onDelete: PropTypes.func.isRequired,
      firstRule: PropTypes.bool,
      canEdit: PropTypes.bool,
    };

    constructor(props) {
      super(props);
      this.state = {loading: false, error: false};
    }

    onDelete = () => {
      if (this.state.loading) {
        return;
      }

      const loadingIndicator = addLoadingMessage();
      const {api, orgId, projectId, data} = this.props;
      api.request(`/projects/${orgId}/${projectId}/rules/${data.id}/`, {
        method: 'DELETE',
        success: () => {
          this.props.onDelete();
          removeIndicator(loadingIndicator);
          addSuccessMessage(tct('Successfully deleted "[alert]"', {alert: data.name}));
        },
        error: () => {
          this.setState({
            error: true,
            loading: false,
          });
          removeIndicator(loadingIndicator);
          addErrorMessage(t('Unable to save changes. Please try again.'));
        },
      });
    };

    render() {
      const {data, canEdit} = this.props;
      const editLink = recreateRoute(`${data.id}/`, this.props);

      const env = EnvironmentStore.getByName(data.environment);

      const environmentName = env ? env.displayName : t('All Environments');

      return (
        <Panel>
          <PanelHeader align="center" justify="space-between" hasButtons>
            <TextColorLink to={editLink}>
              {data.name} - {environmentName}
            </TextColorLink>

            <Flex>
              <Tooltip
                disabled={canEdit}
                title={t('You do not have permission to edit alert rules.')}
              >
                <Button
                  data-test-id="edit-rule"
                  style={{marginRight: 5}}
                  disabled={!canEdit}
                  size="xsmall"
                  to={editLink}
                >
                  {t('Edit Rule')}
                </Button>
              </Tooltip>

              <Tooltip
                disabled={canEdit}
                title={t('You do not have permission to edit alert rules.')}
              >
                <Confirm
                  message={t('Are you sure you want to remove this rule?')}
                  onConfirm={this.onDelete}
                  disabled={!canEdit}
                >
                  <Button size="xsmall" icon="icon-trash" />
                </Confirm>
              </Tooltip>
            </Flex>
          </PanelHeader>

          <PanelBody>
            <RuleDescriptionRow>
              <RuleDescriptionColumn>
                {data.conditions.length !== 0 && (
                  <Condition>
                    <h6>
                      When <strong>{data.actionMatch}</strong> of these conditions are
                      met:
                    </h6>
                    {conditionalGuideAnchor(
                      this.props.firstRule,
                      'alert_conditions',
                      'text',
                      <table className="conditions-list table">
                        <tbody>
                          {data.conditions.map((condition, i) => {
                            return (
                              <tr key={i}>
                                <td>{condition.name}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </Condition>
                )}
              </RuleDescriptionColumn>
              <RuleDescriptionColumn>
                {data.actions.length !== 0 && (
                  <Condition>
                    <h6>
                      Take these actions at most{' '}
                      <strong>
                        once every <Duration seconds={data.frequency * 60} />
                      </strong>{' '}
                      for an issue:
                    </h6>
                    {conditionalGuideAnchor(
                      this.props.firstRule,
                      'alert_actions',
                      'text',
                      <table className="actions-list table">
                        <tbody>
                          {data.actions.map((action, i) => {
                            return (
                              <tr key={i}>
                                <td>{action.name}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </Condition>
                )}
              </RuleDescriptionColumn>
            </RuleDescriptionRow>
          </PanelBody>
        </Panel>
      );
    }
  }
);

class ProjectAlertRules extends AsyncView {
  static propTypes = {
    routes: PropTypes.array.isRequired,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  getEndpoints() {
    const {orgId, projectId} = this.props.params;
    return [['ruleList', `/projects/${orgId}/${projectId}/rules/`]];
  }

  handleDeleteRule = rule => {
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
              key={rule.id}
              data={rule}
              orgId={orgId}
              projectId={projectId}
              params={this.props.params}
              routes={this.props.routes}
              onDelete={this.handleDeleteRule.bind(this, rule)}
              firstRule={this.state.ruleList.indexOf(rule) === 0}
              canEdit={canEditRule}
            />
          );
        })}
      </div>
    );
  }

  renderBody() {
    const {ruleList} = this.state;
    const {organization} = this.context;
    const canEditRule = organization.access.includes('project:write');

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Alerts')}
          action={
            <Tooltip
              disabled={canEditRule}
              title={t('You do not have permission to edit alert rules.')}
            >
              <Button
                disabled={!canEditRule}
                to={recreateRoute('new/', this.props)}
                priority="primary"
                size="small"
                icon="icon-circle-add"
              >
                {t('New Alert Rule')}
              </Button>
            </Tooltip>
          }
          tabs={
            <NavTabs underlined={true}>
              <ListLink to={recreateRoute('alerts', {...this.props, stepBack: -4})}>
                {t('Settings')}
              </ListLink>
              <ListLink to={recreateRoute('', this.props)}>{t('Rules')}</ListLink>
            </NavTabs>
          }
        />
        <PermissionAlert />
        {!!ruleList.length && this.renderResults()}
        {!ruleList.length && this.renderEmpty()}
      </React.Fragment>
    );
  }
}

export default ProjectAlertRules;
