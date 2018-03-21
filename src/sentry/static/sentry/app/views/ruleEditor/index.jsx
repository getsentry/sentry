import $ from 'jquery';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {Select2Field} from '../../components/forms';
import {
  addErrorMessage,
  addSuccessMessage,
  addMessage,
} from '../../actionCreators/indicator';
import {t} from '../../locale';
import ApiMixin from '../../mixins/apiMixin';
import EnvironmentStore from '../../stores/environmentStore';
import LoadingIndicator from '../../components/loadingIndicator';
import Panel from '../settings/components/panel';
import PanelBody from '../settings/components/panelBody';
import PanelHeader from '../settings/components/panelHeader';
import RuleNodeList from './ruleNodeList';
import {ALL_ENVIRONMENTS_KEY} from '../../constants';

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
    let {ruleId, projectId, orgId} = this.props.params;

    if (ruleId) {
      let endpoint = `/projects/${orgId}/${projectId}/rules/${ruleId}/`;
      this.api.request(endpoint, {
        success: rule => {
          this.setState({
            rule,
          });
        },
      });
    } else {
      let defaultRule = {
        actionMatch: 'all',
        actions: [],
        conditions: [],
        name: '',
        frequency: 30,
      };

      this.setState({rule: defaultRule});
    }
  },

  serializeNode(node) {
    let result = {};
    $(node)
      .find('input, select')
      .each((_, el) => {
        if (el.name) {
          result[el.name] = $(el).val();
        }
      });
    return result;
  },

  onSubmit(e) {
    e.preventDefault();
    let form = $(this.formNode);
    let conditions = [];
    form.find('.rule-condition-list .rule-form').each((_, el) => {
      conditions.push(this.serializeNode(el));
    });
    let actions = [];
    form.find('.rule-action-list .rule-form').each((_, el) => {
      actions.push(this.serializeNode(el));
    });

    let data = {...this.state.rule, actions, conditions};

    let rule = this.state.rule;
    let project = this.props.project;
    let org = this.props.organization;
    let endpoint = `/projects/${org.slug}/${project.slug}/rules/`;
    if (rule.id) {
      endpoint += rule.id + '/';
    }

    addMessage(t('Saving...'));

    this.api.request(endpoint, {
      method: rule.id ? 'PUT' : 'POST',
      data,
      success: resp => {
        this.setState({error: null, loading: false, rule: resp});

        browserHistory.replace(`/${org.slug}/${project.slug}/settings/alerts/rules/`);

        addSuccessMessage(rule.id ? t('Updated alert rule') : t('Created alert rule'));
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
    let {error} = this.state;
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
      <form onSubmit={this.onSubmit} ref={node => (this.formNode = node)}>
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
            <div className="control-group">
              <input
                type="text"
                className="form-control"
                defaultValue={name}
                required={true}
                placeholder={t('My Rule Name')}
                onChange={e => this.handleChange('name', e.target.value)}
              />
            </div>

            <hr />

            <div className="node-match-selector">
              <AlertRuleRow>
                {t(
                  'Every time %s of these conditions are met:',
                  <Select2Field
                    className={this.hasError('actionMatch') ? ' error' : ''}
                    style={{marginBottom: 0, marginLeft: 5, marginRight: 5}}
                    name="actionMatch"
                    value={actionMatch}
                    required={true}
                    choices={ACTION_MATCH_CHOICES}
                    onChange={val => this.handleChange('actionMatch', val)}
                  />
                )}
              </AlertRuleRow>
            </div>

            {this.hasError('conditions') && (
              <p className="error">{this.state.error.conditions[0]}</p>
            )}

            <RuleNodeList
              nodes={this.props.conditions}
              initialItems={conditions}
              className="rule-condition-list"
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
              initialItems={actions}
              className="rule-action-list"
            />

            <hr />

            <div className="node-frequency-selector">
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
            </div>

            <div className="actions">
              <button className="btn btn-primary btn-lg" disabled={loading}>
                {t('Save Rule')}
              </button>
            </div>
          </PanelBody>
        </Panel>
      </form>
    );
  },
});

export default RuleEditor;
