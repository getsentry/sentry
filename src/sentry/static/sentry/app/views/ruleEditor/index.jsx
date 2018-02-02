import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import ReactDOM from 'react-dom';
import {browserHistory} from 'react-router';
import $ from 'jquery';
import ApiMixin from '../../mixins/apiMixin';
import IndicatorStore from '../../stores/indicatorStore';
import {Select2Field} from '../../components/forms';
import {t} from '../../locale';
import LoadingIndicator from '../../components/loadingIndicator';
import RuleNodeList from './ruleNodeList';

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
      $(document.body).scrollTop($(ReactDOM.findDOMNode(this.refs.form)).offset().top);
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
    let form = $(ReactDOM.findDOMNode(this.refs.form));
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

    let loadingIndicator = IndicatorStore.add('Saving...');

    this.api.request(endpoint, {
      method: rule.id ? 'PUT' : 'POST',
      data,
      success: resp => {
        this.setState({error: null, loading: false, rule: resp});

        browserHistory.replace(
          `/${org.slug}/${project.slug}/settings/alerts/rules/${resp.id}/`
        );
        IndicatorStore.remove(loadingIndicator);
      },
      error: response => {
        this.setState({
          error: response.responseJSON || {__all__: 'Unknown error'},
          loading: false,
        });
        IndicatorStore.remove(loadingIndicator);
      },
    });
  },

  hasError(field) {
    let {error} = this.state;
    if (!error) return false;
    return !!error[field];
  },

  updateRule(prop, val) {
    let rule = {...this.state.rule};
    rule[prop] = val;
    this.setState({
      rule,
    });
  },

  render() {
    if (!this.state.rule) return <LoadingIndicator />;

    let rule = this.state.rule;
    let {loading, error} = this.state;
    let {actionMatch, actions, conditions, frequency, name} = rule;

    let frequencyChoices = [
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

    let actionMatchChoices = [['all', t('all')], ['any', t('any')], ['none', t('none')]];

    return (
      <form onSubmit={this.onSubmit} ref="form">
        <div className="box rule-detail">
          <div className="box-header">
            <h3>{rule.id ? 'Edit Alert Rule' : 'New Alert Rule'}</h3>
          </div>
          <div className="box-content with-padding">
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
                onChange={e => this.updateRule('name', e.target.value)}
              />
            </div>

            <hr />

            <div className="node-match-selector">
              <h6 style={{display: 'flex', alignItems: 'center'}}>
                {t(
                  'Every time %s of these conditions are met:',
                  <Select2Field
                    className={this.hasError('actionMatch') ? ' error' : ''}
                    style={{marginBottom: 0, marginLeft: 5, marginRight: 5}}
                    name="actionMatch"
                    value={actionMatch}
                    required={true}
                    choices={actionMatchChoices}
                    onChange={val => this.updateRule('actionMatch', val)}
                  />
                )}
              </h6>
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
              <h6 style={{display: 'flex', alignItems: 'center'}}>
                {t(
                  'Perform these actions at most once every %s for an issue.',
                  <Select2Field
                    name="frequency"
                    className={this.hasError('frequency') ? ' error' : ''}
                    value={frequency}
                    style={{marginBottom: 0, marginLeft: 5, marginRight: 5, width: 140}}
                    required={true}
                    choices={frequencyChoices}
                    onChange={val => this.updateRule('frequency', val)}
                  />
                )}
              </h6>
            </div>

            <div className="actions">
              <button className="btn btn-primary btn-lg" disabled={loading}>
                {t('Save Rule')}
              </button>
            </div>
          </div>
        </div>
      </form>
    );
  },
});

export default RuleEditor;
