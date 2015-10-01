import React from "react";

import SelectInput from "../../components/selectInput";
import RuleNode from "./ruleNode";

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

  onAddRow(sel) {
    let nodeId = sel.val();
    if (!nodeId) return;

    sel.val('');

    this.state.items.push({
      id: nodeId
    });
    this.setState({
      items: this.state.items
    });
  },

  onDeleteRow(idx, e) {
    this.state.items.splice(idx, 1);
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
        <table className="node-list table" style={{marginBottom: '10px'}}>
          <col />
          <col style={{ textAlign: 'right'}} />
          <tbody>
            {this.state.items.map((item, idx) => {
              return (
                <RuleNode key={idx}
                  node={this.getNode(item.id)}
                  onDelete={this.onDeleteRow.bind(this, idx)}
                  data={item} />
              );
            })}
          </tbody>
        </table>
        <fieldset className="node-selector">
          <SelectInput onChange={this.onAddRow}>
            <option key="blank" />
            {this.props.nodes.map((node) => {
              return (
                <option value={node.id} key={node.id}>{node.label}</option>
              );
            })}
          </SelectInput>
        </fieldset>
      </div>
    );
  }
});

export default RuleNodeList;
