import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import StyledSelect from '../../../../components/forms/select.styled';
import RuleNode from './ruleNode';

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
    const options = this.props.nodes.filter(n => n.enabled).map(node => ({
      value: node.id,
      label: node.label,
    }));

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
          <StyledSelect
            onChange={opt => {
              if (opt) {
                this.props.handleAddRow(opt.value);
              }
            }}
            style={{width: '100%'}}
            options={options}
          />
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
