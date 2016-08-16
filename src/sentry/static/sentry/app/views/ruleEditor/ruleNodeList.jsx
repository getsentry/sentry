import React from 'react';

import SelectInput from '../../components/selectInput';
import RuleNode from './ruleNode';

const RuleNodeList = React.createClass({
  propTypes: {
    initialItems: React.PropTypes.array,
    nodes: React.PropTypes.array.isRequired
  },

  getInitialState() {
    let counter = 0;
    let initialItems = (this.props.initialItems || []).map(item => {
      return {...item, key_attr: counter++};
    });

    return {
      items: initialItems,
      counter: counter
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
      id: nodeId,
      // Since RuleNode item state is stored outside of React (using innerHTML),
      // need to make sure elements aren't accidentally re-rendered. So, give each
      // row a consistent key using a counter that initializes at 0 when RuleNodeList
      // is mounted.
      key_attr: this.state.counter
    });
    this.setState({
      items: this.state.items,
      counter: this.state.counter + 1
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
          <tbody>
            {this.state.items.map((item, idx) => {
              return (
                <RuleNode key={item.key_attr}
                  node={this.getNode(item.id)}
                  onDelete={this.onDeleteRow.bind(this, idx)}
                  data={item} />
              );
            })}
          </tbody>
        </table>
        <fieldset className="node-selector">
          <SelectInput onChange={this.onAddRow} style={{width: '100%'}}>
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
