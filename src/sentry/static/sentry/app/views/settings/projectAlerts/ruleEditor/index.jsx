import $ from 'jquery';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {ALL_ENVIRONMENTS_KEY} from '../../../../constants';
import {Panel, PanelBody, PanelHeader} from '../../../../components/panels';
import {Select2Field, TextField} from '../../../../components/forms';
import {
  addErrorMessage,
  addSuccessMessage,
  addMessage,
} from '../../../../actionCreators/indicator';
import {t} from '../../../../locale';
import ApiMixin from '../../../../mixins/apiMixin';
import Button from '../../../../components/buttons/button';
import EnvironmentStore from '../../../../stores/environmentStore';
import LoadingIndicator from '../../../../components/loadingIndicator';
import RuleNodeList from './ruleNodeList';
import recreateRoute from '../../../../utils/recreateRoute';
import space from '../../../../styles/space';

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
    actions: PropTypes.array.isRequired,
    conditions: PropTypes.array.isRequired,
    project: PropTypes.object.isRequired,
    organization: PropTypes.object.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      rule: null,
      loading: false,
      error: null,
    };
  },

  componentDidMount() {
    this.fetchRule();
  },

  componentDidUpdate() {
    if (this.state.error) {
      $(document.body).scrollTop($(this.formNode).offset().top);
    }
  },

  fetchRule() {
    const {ruleId, projectId, orgId} = this.props.params;

    if (ruleId) {
      const endpoint = `/projects/${orgId}/${projectId}/rules/${ruleId}/`;
      this.api.request(endpoint, {
        success: rule => {
          this.setState({
            rule,
          });
        },
      });
    } else {
      const defaultRule = {
        actionMatch: 'all',
        actions: [],
        conditions: [],
        name: '',
        frequency: 30,
        environment: ALL_ENVIRONMENTS_KEY,
      };

      this.setState({rule: defaultRule});
    }
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

    this.api.request(endpoint, {
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
    if (!error) return false;
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
    const activeEnvs = EnvironmentStore.getActive() || [];
    const environmentChoices = [
      [ALL_ENVIRONMENTS_KEY, t('All Environments')],
      ...activeEnvs.map(env => [env.name, env.displayName]),
    ];

    if (!this.state.rule) return <LoadingIndicator />;

    const {rule, loading, error} = this.state;
    const {actionMatch, actions, conditions, frequency, name} = rule;

    const environment =
      rule.environment === null ? ALL_ENVIRONMENTS_KEY : rule.environment;

    return (
      <form onSubmit={this.handleSubmit} ref={node => (this.formNode = node)}>
        <Panel className="rule-detail">
          <PanelHeader>{rule.id ? 'Edit Alert Rule' : 'New Alert Rule'}</PanelHeader>
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
              required={true}
              placeholder={t('My Rule Name')}
              onChange={val => this.handleChange('name', val)}
            />

            <hr />

            <AlertRuleRow>
              {t(
                'Every time %s of these conditions are met:',
                <Select2Field
                  className={this.hasError('actionMatch') ? ' error' : ''}
                  style={{marginBottom: 0, marginLeft: 5, marginRight: 5, width: 100}}
                  name="actionMatch"
                  value={actionMatch}
                  required={true}
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
            <Select2Field
              className={this.hasError('environment') ? ' error' : ''}
              style={{marginBottom: 0, marginLeft: 5, marginRight: 5}}
              name="environment"
              value={environment}
              required={true}
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
                <Select2Field
                  name="frequency"
                  className={this.hasError('frequency') ? ' error' : ''}
                  value={frequency}
                  style={{marginBottom: 0, marginLeft: 5, marginRight: 5, width: 140}}
                  required={true}
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

export default RuleEditor;

const CancelButton = styled(Button)`
  margin-right: ${space(1)};
`;

const ActionBar = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding: ${space(2)};
  border-top: 1px solid ${p => p.theme.borderLight};
  margin: 0 -20px -20px;
`;
