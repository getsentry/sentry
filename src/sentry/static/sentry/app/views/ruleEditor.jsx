var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");
var $ = require("jquery");

var api = require("../api");
var IndicatorStore = require('../stores/indicatorStore');
var utils = require("../utils");

var RuleNodeList = React.createClass({
  getInitialState() {
    return {
      items: this.props.initialItems || []
    };
  },

  componentWillMount() {
    this._nodesById = {};
    this.props.nodes.forEach((node) => {
      this._nodesById[node.id] = node;
    });
  },

  onAddRow(e) {
    var $el = $(e.target);
    var nodeId = $el.val();

    $el.val('');

    if (!nodeId) return;

    this.state.items.push({
      id: nodeId
    });
    this.setState({
      items: this.state.items
    });
  },

  onDeleteRow(idx, e) {
    this.state.items.splice(idx, idx + 1);
    this.setState({
      items: this.state.items
    });
  },

  getNode(id) {
    return this._nodesById[id];
  },

  render() {
    return (
      <div className={this.props.className}>
        <table className="actions-list table" style={{marginBottom: '10px'}}>
          <col />
          <col style={{ textAlign: 'right'}} />
          <tbody>
            {this.state.items.map((item, idx) => {
              return (
                <tr key={idx}>
                  <td className="rule-form">
                    <input type="hidden" name="id" value={item.id} />
                    <span dangerouslySetInnerHTML={{__html: this.getNode(item.id).html}} />
                  </td>
                  <td className="align-right">
                    <a onClick={this.onDeleteRow.bind(this, idx)}><span className="icon-trash" /></a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <fieldset>
          <select onChange={this.onAddRow}>
            <option key="blank" />
            {this.props.nodes.map((node) => {
              return (
                <option value={node.id} key={node.id}>{node.label}</option>
              );
            })}
          </select>
        </fieldset>
      </div>
    );
  }
});

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
    var endpoint = '/projects/' + org.slug + '/' + project.slug + '/rules/' + rule.id + '/';

    var loadingIndicator = IndicatorStore.add('Saving...');
    api.request(endpoint, {
      method: "PUT",
      data: data,
      success: () => {
        window.location.href = '../../';
      },
      error: (data) => {
        this.setState({
          error: data || 'Unknown error',
          loading: false
        });
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
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
              <select ref="actionMatch"
                      className="selectize-inline"
                      defaultValue={actionMatch}
                      required={true}>
                <option value="all">all</option>
                <option value="any">any</option>
                <option value="none">none</option>
              </select>
              of these conditions are met:
            </h6>

            <RuleNodeList nodes={this.props.conditions}
              initialItems={conditions}
              className="rule-condition-list"
              onChange={this.onConditionsChange} />

            <h6>Take these actions:</h6>

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

module.exports = RuleEditor;
