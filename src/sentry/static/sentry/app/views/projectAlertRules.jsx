import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {t} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import Button from '../components/buttons/button';
import Confirm from '../components/confirm';
import Duration from '../components/duration';
import IndicatorStore from '../stores/indicatorStore';
import ListLink from '../components/listLink';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Panel from './settings/components/panel';
import PanelBody from './settings/components/panelBody';
import PanelHeader from './settings/components/panelHeader';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import recreateRoute from '../utils/recreateRoute';

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

const RuleRow = createReactClass({
  displayName: 'RuleRow',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    onDelete: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
      error: false,
    };
  },

  onDelete() {
    if (this.state.loading) return;

    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {orgId, projectId, data} = this.props;
    this.api.request(`/projects/${orgId}/${projectId}/rules/${data.id}/`, {
      method: 'DELETE',
      success: (d, _, jqXHR) => {
        this.props.onDelete();
        IndicatorStore.remove(loadingIndicator);
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
        IndicatorStore.remove(loadingIndicator);
        IndicatorStore.add(t('Unable to save changes. Please try again.'), 'error');
      },
    });
  },

  render() {
    let {data} = this.props;
    let editLink = recreateRoute(`${data.id}/`, this.props);

    return (
      <Panel>
        <PanelHeader
          css={{paddingTop: 5, paddingBottom: 5}}
          isFlex
          align="center"
          justify="space-between"
        >
          <TextColorLink to={editLink}>{data.name}</TextColorLink>

          <div>
            <Button style={{marginRight: 5}} size="small" to={editLink}>
              {t('Edit Rule')}
            </Button>

            <Confirm
              message={t('Are you sure you want to remove this rule?')}
              onConfirm={this.onDelete}
            >
              <Button size="small">
                <span className="icon-trash" />
              </Button>
            </Confirm>
          </div>
        </PanelHeader>

        <PanelBody>
          <RuleDescriptionRow>
            <RuleDescriptionColumn>
              {data.conditions.length !== 0 && (
                <Condition>
                  <h6>
                    When <strong>{data.actionMatch}</strong> of these conditions are met:
                  </h6>
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
                </Condition>
              )}
            </RuleDescriptionColumn>
          </RuleDescriptionRow>
        </PanelBody>
      </Panel>
    );
  },
});

const ProjectAlertRules = createReactClass({
  displayName: 'ProjectAlertRules',
  propTypes: {
    routes: PropTypes.array.isRequired,
  },
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      ruleList: [],
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/rules/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          ruleList: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  onDeleteRule(rule) {
    this.setState({
      ruleList: this.state.ruleList.filter(r => r.id !== rule.id),
    });
  },

  renderBody() {
    let body;

    if (this.state.loading) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.ruleList.length) body = this.renderResults();
    else body = this.renderEmpty();

    return body;
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('There are no alerts configured for this project.')}</p>
      </div>
    );
  },

  renderResults() {
    let {orgId, projectId} = this.props.params;
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
              onDelete={this.onDeleteRule.bind(this, rule)}
            />
          );
        })}
      </div>
    );
  },

  render() {
    return (
      <div>
        <SettingsPageHeader
          title={t('Alerts')}
          action={
            <Button
              to={recreateRoute('new/', this.props)}
              priority="primary"
              size="small"
              icon="icon-circle-add"
            >
              {t('New Alert Rule')}
            </Button>
          }
          tabs={
            <ul className="nav nav-tabs" style={{borderBottom: '1px solid #ddd'}}>
              <ListLink
                to={recreateRoute('alerts/', {...this.props, stepBack: -1})}
                index={true}
              >
                {t('Settings')}
              </ListLink>
              <ListLink to={recreateRoute('', this.props)}>{t('Rules')}</ListLink>
            </ul>
          }
        />

        {this.renderBody()}
      </div>
    );
  },
});

export default ProjectAlertRules;
