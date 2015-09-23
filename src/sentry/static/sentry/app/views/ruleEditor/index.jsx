import React from "react";
import $ from "jquery";
import api from "../../api";
import IndicatorStore from '../../stores/indicatorStore';
import Selectize from "../../components/selectize";

import RuleNodeList from "./ruleNodeList";

var RuleEditor = React.createClass({
  propTypes: {
    actions: React.PropTypes.instanceOf(Array).isRequired,
    conditions: React.PropTypes.instanceOf(Array).isRequired
  },

  getInitialState() {
    return {
      loading: false,
      error: null
    };
  },

  serializeNode(node) {
    var result = {};
    $(node).find('input, select').each(function() {
      result[this.name] = $(this).val();
    });
    return result;
  },

  componentDidUpdate() {
    if (this.state.error) {
      $(document.body).scrollTop($(this.refs.form.getDOMNode()).offset().top);
    }
  },

  onSubmit(e) {
    e.preventDefault();
    var form = $(this.refs.form.getDOMNode());
    var conditions = [];
    form.find('.rule-condition-list .rule-form').each((_, el) => {
      conditions.push(this.serializeNode(el));
    });
    var actions = [];
    form.find('.rule-action-list .rule-form').each((_, el) => {
      actions.push(this.serializeNode(el));
    });
    var actionMatch = $(this.refs.actionMatch.getDOMNode()).val();
    var name = $(this.refs.name.getDOMNode()).val();
    var data = {
      actionMatch: actionMatch,
      actions: actions,
      conditions: conditions,
      name: name
    };
    var rule = this.props.rule;
    var project = this.props.project;
    var org = this.props.organization;
    var endpoint = '/projects/' + org.slug + '/' + project.slug + '/rules/';
    if (rule.id) {
      endpoint += rule.id + '/';
    }

    var loadingIndicator = IndicatorStore.add('Saving...');
    api.request(endpoint, {
      method: (rule.id ? "PUT" : "POST"),
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
    var {error} = this.state;
    if (!error) return false;
    return !!error[field];
  },

  render() {
    var rule = this.props.rule;
    var {loading, error} = this.state;
    var {actionMatch, actions, conditions, name} = rule;

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
                <p>There was an error saving your changes. Make sure all fields are valid and try again.</p>
              </div>
            }
            <h6>Rule name:</h6>
            <input ref="name"
                   type="text" className="form-control"
                   defaultValue={name}
                   required={true}
                   placeholder="My Rule Name" />
            <hr/>
            <h6>
              Every time
              <Selectize ref="actionMatch"
                      className={"selectize-inline" + (this.hasError('actionMatch') ? ' error' : '')}
                      value={actionMatch}
                      required={true}>
                <option value="all">all</option>
                <option value="any">any</option>
                <option value="none">none</option>
              </Selectize>
              of these conditions are met:
            </h6>

            {this.hasError('conditions') &&
              <p className="error">Ensure at least one condition is enabled and all required fields are filled in.</p>
            }

            <RuleNodeList nodes={this.props.conditions}
              initialItems={conditions}
              className="rule-condition-list"
              onChange={this.onConditionsChange} />

            <h6>Take these actions:</h6>

            {this.hasError('actions') &&
              <p className="error">Ensure at least one condition is enabled and all required fields are filled in.</p>
            }

            <RuleNodeList nodes={this.props.actions}
              initialItems={actions}
              className="rule-action-list"
              onChange={this.onActionsChange} />

            <div className="actions">
              <button className="btn btn-primary btn-lg"
                      disabled={loading}>Save Rule</button>
            </div>
          </div>
        </div>
      </form>
    );
  }
});

export default RuleEditor;
