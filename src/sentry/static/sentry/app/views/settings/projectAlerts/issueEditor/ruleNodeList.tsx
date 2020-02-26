import React from 'react';
import styled from '@emotion/styled';

import {
  IssueAlertRuleAction,
  IssueAlertRuleActionTemplate,
  IssueAlertRuleCondition,
  IssueAlertRuleConditionTemplate,
} from 'app/types/alerts';
import SelectControl from 'app/components/forms/selectControl';
import space from 'app/styles/space';

import RuleNode from './ruleNode';

type Props = {
  // All available actions or conditions
  nodes: IssueAlertRuleActionTemplate[] | IssueAlertRuleConditionTemplate[] | null;

  // actions/conditions that have been added to the rule
  items?: IssueAlertRuleAction[] | IssueAlertRuleCondition[];

  // Placeholder for select control
  placeholder: string;

  onPropertyChange: (ruleIndex: number, prop: string, val: string) => void;

  onAddRow: (value: string) => void;

  onDeleteRow: (ruleIndex: number) => void;
};

class RuleNodeList extends React.Component<Props> {
  getNode = (
    id: string
  ):
    | IssueAlertRuleActionTemplate
    | IssueAlertRuleConditionTemplate
    | null
    | undefined => {
    const {nodes} = this.props;
    return nodes ? nodes.find(node => node.id === id) : null;
  };

  render() {
    const {
      onAddRow,
      onDeleteRow,
      onPropertyChange,
      nodes,
      placeholder,
      items,
    } = this.props;

    const options = nodes
      ? nodes
          .filter(({enabled}) => enabled)
          .map(node => ({
            value: node.id,
            label: node.label,
          }))
      : [];

    return (
      <React.Fragment>
        {items && !!items.length && (
          <RuleNodes>
            {items.map((item, idx) => {
              return (
                <RuleNode
                  key={idx}
                  index={idx}
                  node={this.getNode(item.id)}
                  onDelete={onDeleteRow}
                  data={item}
                  onPropertyChange={onPropertyChange}
                />
              );
            })}
          </RuleNodes>
        )}
        <StyledSelectControl
          placeholder={placeholder}
          value={null}
          onChange={obj => onAddRow(obj ? obj.value : obj)}
          options={options}
        />
      </React.Fragment>
    );
  }
}

export default RuleNodeList;

const StyledSelectControl = styled(SelectControl)`
  width: 100%;
`;

const RuleNodes = styled('div')`
  display: grid;
  margin-bottom: ${space(2)};
  grid-gap: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-auto-flow: row;
  }
`;
