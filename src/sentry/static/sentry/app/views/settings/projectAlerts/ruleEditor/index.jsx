import $ from 'jquery';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {ALL_ENVIRONMENTS_KEY} from 'app/constants';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {SelectField, TextField} from 'app/components/forms';
import {
  addErrorMessage,
  addSuccessMessage,
  addMessage,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import Button from 'app/components/button';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import RuleNodeList from 'app/views/settings/projectAlerts/ruleEditor/ruleNodeList';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';
import {getDisplayName} from 'app/utils/environment';

const FREQUENCY_CHOICES = [
  ['5', t('5 minutes')],
  ['10', t('10 minutes')],
  ['30', t('30 minutes')],
  ['60', t('60 minutes')],
  ['180', t('3 hours')],
  ['720', t('12 hours')],
  ['1440', t('24 hours')],
  ['10080', t('one week')],
  ['43200', t('30 days')],
];

const ACTION_MATCH_CHOICES = [['all', t('all')], ['any', t('any')], ['none', t('none')]];

const AlertRuleRow = styled('h6')`
  display: flex;
  align-items: center;
`;

const RuleEditor = createReactClass({
  displayName: 'RuleEditor',

  propTypes: {
    api: PropTypes.object,
    actions: PropTypes.array.isRequired,
    conditions: PropTypes.array.isRequired,
    project: PropTypes.object.isRequired,
    organization: PropTypes.object.isRequired,
  },

  getInitialState() {
    return {
      rule: null,
      loading: false,
      error: null,
      environments: [],
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  componentDidUpdate() {
    if (this.state.error) {
      $(document.body).scrollTop($(this.formNode).offset().top);
    }
  },

  fetchData() {
    const {
      api,
      params: {ruleId, projectId, orgId},
    } = this.props;

    const defaultRule = {
      actionMatch: 'all',
      actions: [],
      conditions: [],
      name: '',
      frequency: 30,
      environment: ALL_ENVIRONMENTS_KEY,
    };

    const promises = [
      api.requestPromise(`/projects/${orgId}/${projectId}/environments/`),
      ruleId
        ? api.requestPromise(`/projects/${orgId}/${projectId}/rules/${ruleId}/`)
        : Promise.resolve(defaultRule),
    ];

    Promise.all(promises).then(([environments, rule]) => {
      this.setState({environments, rule});
    });
  },

  handleSubmit(e) {
    e.preventDefault();

    const data = {...this.state.rule};
    const isNew = !data.id;
    const {project, organization} = this.props;

    let endpoint = `/projects/${organization.slug}/${project.slug}/rules/`;
    if (data.id) {
      endpoint += data.id + '/';
    }

    if (data.environment === ALL_ENVIRONMENTS_KEY) {
      delete data.environment;
    }

    addMessage(t('Saving...'));

    this.props.api.request(endpoint, {
      method: isNew ? 'POST' : 'PUT',
      data,
      success: resp => {
        this.setState({error: null, loading: false, rule: resp});
        // Redirect to correct ID if /new
        if (isNew) {
          browserHistory.replace(
            recreateRoute(`${resp.id}/`, {...this.props, stepBack: -1})
          );
        }
        addSuccessMessage(isNew ? t('Created alert rule') : t('Updated alert rule'));
      },
      error: response => {
        this.setState({
          error: response.responseJSON || {__all__: 'Unknown error'},
          loading: false,
        });
        addErrorMessage(t('An error occurred'));
      },
    });
  },

  hasError(field) {
    const {error} = this.state;
    if (!error) {
      return false;
    }
    return !!error[field];
  },

  handleEnvironmentChange(val) {
    // If 'All Environments' is selected the value should be null
    if (val === ALL_ENVIRONMENTS_KEY) {
      this.handleChange('environment', null);
    } else {
      this.handleChange('environment', val);
    }
  },

  handleChange(prop, val) {
    this.setState(state => {
      const rule = {...state.rule};
      rule[prop] = val;
      return {rule};
    });
  },

  handlePropertyChange(type) {
    return idx => {
      return (prop, val) => {
        const rule = {...this.state.rule};
        rule[type][idx][prop] = val;
        this.setState({rule});
      };
    };
  },

  handleAddRow(type) {
    return id => {
      this.setState(prevState => {
        prevState.rule[type].push({id});
        return {
          rule: prevState.rule,
        };
      });
    };
  },

  handleDeleteRow(type) {
    return idx => {
      this.setState(prevState => {
        prevState.rule[type].splice(idx, 1);
        return {
          rule: prevState.rule,
        };
      });
    };
  },

  render() {
    const {projectId} = this.props.params;
    const {environments} = this.state;
    const environmentChoices = [
      [ALL_ENVIRONMENTS_KEY, t('All Environments')],
      ...environments.map(env => [env.name, getDisplayName(env)]),
    ];

    if (!this.state.rule) {
      return <LoadingIndicator />;
    }

    const {rule, loading, error} = this.state;
    const {actionMatch, actions, conditions, frequency, name} = rule;

    const environment =
      rule.environment === null ? ALL_ENVIRONMENTS_KEY : rule.environment;

    const title = rule.id ? t('Edit Alert Rule') : t('New Alert Rule');

    return (
      <form onSubmit={this.handleSubmit} ref={node => (this.formNode = node)}>
        <SentryDocumentTitle title={title} objSlug={projectId} />
        <Panel className="rule-detail">
          <PanelHeader>{title}</PanelHeader>
          <PanelBody disablePadding={false}>
            {error && (
              <div className="alert alert-block alert-error">
                <p>
                  {t(
                    'There was an error saving your changes. Make sure all fields are valid and try again.'
                  )}
                </p>
              </div>
            )}
            <h6>{t('Rule name')}:</h6>
            <TextField
              name="name"
              defaultValue={name}
              required
              placeholder={t('My Rule Name')}
              onChange={val => this.handleChange('name', val)}
            />

            <hr />

            <AlertRuleRow>
              {t(
                'Every time %s of these conditions are met:',
                <SelectField
                  clearable={false}
                  className={this.hasError('actionMatch') ? ' error' : ''}
                  style={{marginBottom: 0, marginLeft: 5, marginRight: 5, width: 100}}
                  name="actionMatch"
                  value={actionMatch}
                  required
                  choices={ACTION_MATCH_CHOICES}
                  onChange={val => this.handleChange('actionMatch', val)}
                />
              )}
            </AlertRuleRow>

            {this.hasError('conditions') && (
              <p className="error">{this.state.error.conditions[0]}</p>
            )}

            <RuleNodeList
              nodes={this.props.conditions}
              items={conditions || []}
              className="rule-condition-list"
              handlePropertyChange={this.handlePropertyChange('conditions')}
              handleAddRow={this.handleAddRow('conditions')}
              handleDeleteRow={this.handleDeleteRow('conditions')}
            />

            <hr />

            <h6>{t('In this environment')}:</h6>
            <SelectField
              clearable={false}
              className={this.hasError('environment') ? ' error' : ''}
              style={{marginBottom: 0, marginLeft: 5, marginRight: 5}}
              name="environment"
              value={environment}
              required
              choices={environmentChoices}
              onChange={val => this.handleEnvironmentChange(val)}
            />

            <hr />

            <h6>{t('Take these actions:')}</h6>

            {this.hasError('actions') && (
              <p className="error">{this.state.error.actions[0]}</p>
            )}

            <RuleNodeList
              nodes={this.props.actions}
              items={actions || []}
              handlePropertyChange={this.handlePropertyChange('actions')}
              handleAddRow={this.handleAddRow('actions')}
              handleDeleteRow={this.handleDeleteRow('actions')}
            />

            <hr />

            <AlertRuleRow>
              {t(
                'Perform these actions at most once every %s for an issue.',
                <SelectField
                  clearable={false}
                  name="frequency"
                  className={this.hasError('frequency') ? ' error' : ''}
                  value={frequency}
                  style={{marginBottom: 0, marginLeft: 5, marginRight: 5, width: 140}}
                  required
                  choices={FREQUENCY_CHOICES}
                  onChange={val => this.handleChange('frequency', val)}
                />
              )}
            </AlertRuleRow>

            <ActionBar>
              <CancelButton to={recreateRoute('', {...this.props, stepBack: -1})}>
                {t('Cancel')}
              </CancelButton>
              <Button priority="primary" disabled={loading}>
                {t('Save Rule')}
              </Button>
            </ActionBar>
          </PanelBody>
        </Panel>
      </form>
    );
  },
});

export {RuleEditor};

export default withApi(RuleEditor);

const CancelButton = styled(Button)`
  margin-right: ${space(1)};
`;

const ActionBar = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding: ${space(2)};
  border-top: 1px solid ${p => p.theme.borderLight};
  margin: 0 -${space(2)} -${space(2)};
`;
