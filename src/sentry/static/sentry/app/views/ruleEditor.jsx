/*** @jsx React.DOM */
var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");
var $ = require("jquery");

var api = require("../api");
var utils = require("../utils");

var RuleAction = React.createClass({
  propTypes: {
    type: React.PropTypes.string.isRequired
  },

  render() {
    return (
      <tr>
        <td></td>
        <td className="align-right">
          <button className="btn btn-default btn-sm">
            <span className="icon-trash"></span>
          </button>
        </td>
      </tr>
    );
  }
});

var RuleCondition = React.createClass({
  propTypes: {
    type: React.PropTypes.string.isRequired
  },

  render() {
    return (
      <tr>
        <td></td>
        <td className="align-right">
          <button className="btn btn-default btn-sm">
            <span className="icon-trash"></span>
          </button>
        </td>
      </tr>
    );
  }
});

var RuleConditionList = React.createClass({
  render() {
    var conditions = [];

    return (
      <div className="box">
          <div className="box-header" style={{paddingTop: '5px', paddingBottom: 0, fontWeight: 500}}>
              Every time
              <select name="action_match" style={{width: '100px'}}
                      className="select2-small select2-inline">
                <option value="all">all of</option>
                <option value="any">any of</option>
                <option value="none">none of</option>
              </select>
              these conditions are met:
          </div>
          <div className="box-content" style={{padding: '0 10px 6px'}}>
            <table className="condition-list table table-light" style={{marginBottom: '10px'}}>
                <col />
                <col style={{width: '10%', textAlign: 'right'}} />
                <tbody>
                  {conditions}
                </tbody>
            </table>
            <div className="controls">
                <select placeholder="add a condition">
                  <option key="blank"/>
                  {this.props.conditions.map((condition) => {
                    return (
                      <option value={condition.id} key={condition.id}>{condition.label}</option>
                    );
                  })}
                </select>
            </div>
          </div>
      </div>
    );
  }
});

var RuleActionList = React.createClass({
  getInitialState() {
    return {
      items: []
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
    if (!nodeId) return;
    this.state.items.push({
      id: nodeId
    });
    this.setState({
      items: this.state.items
    });
    $el.val('');
  },

  onDeleteRow(idx) {
    this.state.items.splice(idx, idx + 1);
    this.setState({
      items: this.state.items
    });
  },

  getNode(id) {
    return this._nodesById[id];
  },

  render() {
    var actions = [];

    return (
      <div className="box">
        <div className="box-header">
          <h3>Take these actions:</h3>
        </div>
        <div className="box-content" style={{padding: '0 10px 6px'}}>
          <table className="action-list table table-light" style={{marginBottom: '10px'}}>
            <col />
            <col style={{width: '25%', textAlign: 'right'}} />
            <tbody>
              {this.state.items.map((item, idx) => {
                return (
                  <tr key={idx}>
                    <td dangerouslySetInnerHTML={{__html: this.getNode(item.id).html}} />
                    <td className="align-right">
                      <a onClick={this.onDeleteRow.bind(this, idx)}><span className="icon-trash" /></a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="controls">
            <select placeholder="add an action" onChange={this.onAddRow}>
              <option key="blank"/>
              {this.props.nodes.map((node) => {
                return (
                  <option value={node.id} key={node.id}>{node.label}</option>
                );
              })}
            </select>
          </div>
        </div>
      </div>
    );
  }
});

var RuleName = React.createClass({
  render() {
    return (
      <div className="box">
        <div className="box-header">
          <h3>Rule name:</h3>
        </div>
        <div className="box-content" style={{padding: '10px'}}>
          <input type="text" name="label" className="form-control"
                 placeholder="e.g. My Rule Name" defaultValue={this.props.value} />
        </div>
      </div>
    );
  }
});

var RuleEditor = React.createClass({
  propTypes: {
    actions: React.PropTypes.instanceOf(Array).isRequired,
    conditions: React.PropTypes.instanceOf(Array).isRequired
  },

  render() {
    var rule = this.props.rule;

    return (
      <form>
        <h3>
          {rule.id ? 'Edit Rule' : 'New Rule'}
          <small>Applying to Events</small>
        </h3>

        <RuleName value={rule.name} />
        <RuleConditionList conditions={this.props.conditions} />
        <RuleActionList nodes={this.props.actions} />
        <div className="actions">
          <button className="btn btn-primary btn-lg">Save Rule</button>
        </div>
      </form>
    );
  }
});

module.exports = RuleEditor;
