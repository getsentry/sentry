import React from 'react';
import ReactDOM from 'react-dom';
import $ from 'jquery';
import ApiMixin from '../../mixins/apiMixin';
import IndicatorStore from '../../stores/indicatorStore';
import SelectInput from '../../components/selectInput';
import {t} from '../../locale';

import RuleNodeList from './ruleNodeList';

const RuleEditor = React.createClass({
  propTypes: {
    actions: React.PropTypes.array.isRequired,
    conditions: React.PropTypes.array.isRequired,
    rule: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    organization: React.PropTypes.object.isRequired
  },

  mixins: [
    ApiMixin
  ],

  getInitialState() {
    return {
      loading: false,
      error: null
    };
  },

  componentDidUpdate() {
    if (this.state.error) {
      $(document.body).scrollTop($(ReactDOM.findDOMNode(this.refs.form)).offset().top);
    }
  },

  serializeNode(node) {
    let result = {};
    $(node).find('input, select').each((_, el) => {
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
    let actionMatch = $(ReactDOM.findDOMNode(this.refs.actionMatch)).val();
    let name = $(ReactDOM.findDOMNode(this.refs.name)).val();
    let data = {
      actionMatch: actionMatch,
      actions: actions,
      conditions: conditions,
      name: name
    };
    let rule = this.props.rule;
    let project = this.props.project;
    let org = this.props.organization;
    let endpoint = '/projects/' + org.slug + '/' + project.slug + '/rules/';
    if (rule.id) {
      endpoint += rule.id + '/';
    }

    let loadingIndicator = IndicatorStore.add('Saving...');
    this.api.request(endpoint, {
      method: (rule.id ? 'PUT' : 'POST'),
      data: data,
      success: () => {
        window.location.href = (rule.id ? '../../' : '../');
      },
      error: (response) => {
        this.setState({
          error: response.responseJSON || {'__all__': 'Unknown error'},
          loading: false
        });
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  hasError(field) {
    let {error} = this.state;
    if (!error) return false;
    return !!error[field];
  },

  render() {
    let rule = this.props.rule;
    let {loading, error} = this.state;
    let {actionMatch, actions, conditions, name} = rule;

    return (
      <form onSubmit={this.onSubmit} ref="form">
        <div className="box rule-detail">
          <div className="box-header">
            <h3>
              {rule.id ? 'Edit Rule' : 'New Rule'}
            </h3>
          </div>
          <div className="box-content with-padding">
            {error &&
              <div className="alert alert-block alert-error">
                <p>{t('There was an error saving your changes. Make sure all fields are valid and try again.')}</p>
              </div>
            }
            <h6>{t('Rule name')}:</h6>
            <input ref="name"
                   type="text" className="form-control"
                   defaultValue={name}
                   required={true}
                   placeholder={t('My Rule Name')} />
            <hr/>

            <div className="node-match-selector">
              <h6>
                {t('Every time %s of these conditions are met:',
                  <SelectInput ref="actionMatch"
                        className={(this.hasError('actionMatch') ? ' error' : '')}
                        value={actionMatch}
                        style={{width:80}}
                        required={true}>
                    <option value="all">{t('all')}</option>
                    <option value="any">{t('any')}</option>
                    <option value="none">{t('none')}</option>
                  </SelectInput>
                )}
              </h6>
            </div>

            {this.hasError('conditions') &&
              <p className="error">{t('Ensure at least one condition is enabled and all required fields are filled in.')}</p>
            }

            <RuleNodeList nodes={this.props.conditions}
              initialItems={conditions}
              className="rule-condition-list"
              onChange={this.onConditionsChange} />

            <h6>{t('Take these actions:')}</h6>

            {this.hasError('actions') &&
              <p className="error">{t('Ensure at least one condition is enabled and all required fields are filled in.')}</p>
            }

            <RuleNodeList nodes={this.props.actions}
              initialItems={actions}
              className="rule-action-list"
              onChange={this.onActionsChange} />

            <div className="actions">
              <button className="btn btn-primary btn-lg"
                      disabled={loading}>{t('Save Rule')}</button>
            </div>
          </div>
        </div>
      </form>
    );
  }
});

export default RuleEditor;
