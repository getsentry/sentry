/*** @jsx React.DOM */
var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");
var $ = require("jquery");

var api = require("../api");
var utils = require("../utils");

var RuleNode = React.createClass({
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

var RuleNodeList = React.createClass({
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
      <div>
        <table className="actions-list table" style={{marginBottom: '10px'}}>
          <col />
          <col style={{ textAlign: 'right'}} />
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
        <fieldset>
          <select onChange={this.onAddRow}>
            <option key="blank"/>
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

var RuleName = React.createClass({
  render() {
    return (
      <div>
        <h6>Rule name:</h6>
        <input type="text" name="label" className="form-control"
               placeholder="My Rule Name" defaultValue={this.props.value} />
        <hr/>
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
        <div className="box rule-detail">
          <div className="box-header">
            <h3>
              {rule.id ? 'Edit Rule' : 'New Rule'}
            </h3>
          </div>
          <div className="box-content with-padding">
            <RuleName value={rule.name} />
            <h6>
              Every time
              <select name="action_match"
                      className="select2-small select2-inline">
                <option value="all">all</option>
                <option value="any">any</option>
                <option value="none">none</option>
              </select>
              of these conditions are met:
            </h6>

            <RuleNodeList nodes={this.props.conditions} />

            <h6>Take these actions:</h6>

            <RuleNodeList nodes={this.props.actions} />

            <div className="actions">
              <button className="btn btn-primary btn-lg">Save Rule</button>
            </div>
          </div>
        </div>
      </form>
    );
  }
});

module.exports = RuleEditor;
