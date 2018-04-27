import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import SelectInput from 'app/components/selectInput';
import RuleNode from 'app/views/settings/projectAlerts/ruleEditor/ruleNode';

class RuleNodeList extends React.Component {
  static propTypes = {
    items: PropTypes.array,
    nodes: PropTypes.array.isRequired,
    handlePropertyChange: PropTypes.func.isRequired,
    handleAddRow: PropTypes.func.isRequired,
    handleDeleteRow: PropTypes.func.isRequired,
  };

  getNode = id => {
    return this.props.nodes.find(node => node.id === id);
  };

  render() {
    return (
      <div className={this.props.className}>
        <RuleNodes>
          {this.props.items.map((item, idx) => {
            return (
              <RuleNode
                key={idx}
                node={this.getNode(item.id)}
                handleDelete={() => this.props.handleDeleteRow(idx)}
                data={item}
                handlePropertyChange={this.props.handlePropertyChange(idx)}
              />
            );
          })}
        </RuleNodes>
        <fieldset>
          <SelectInput
            onChange={sel2 => this.props.handleAddRow(sel2.val())}
            style={{width: '100%'}}
          >
            <option key="blank" />
            {this.props.nodes.filter(n => n.enabled).map(node => {
              return (
                <option value={node.id} key={node.id}>
                  {node.label}
                </option>
              );
            })}
          </SelectInput>
        </fieldset>
      </div>
    );
  }
}

export default RuleNodeList;

const RuleNodes = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
`;
