import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';
import RuleNode, {ruleNodesMap} from 'sentry/views/automations/components/ruleNode';

interface RuleNodeListProps {
  conditions: Record<string, any>;
  group: string;
  onAddRow: (type: string) => void;
  onDeleteRow: (id: number) => void;
  placeholder: string;
  updateCondition: (index: number, condition: Record<string, any>) => void;
}

export default function RuleNodeList({
  group,
  placeholder,
  conditions,
  onAddRow,
  onDeleteRow,
  updateCondition,
}: RuleNodeListProps) {
  const options = Object.entries(ruleNodesMap).map(([value, node]) => ({
    value,
    label: node.label,
  }));

  return (
    <Fragment>
      {Object.entries(conditions).map(([i, condition]) => (
        <RuleNode
          key={`${group}.conditions.${i}`}
          condition_id={`${group}.conditions.${i}`}
          condition={condition}
          onDelete={() => {
            onDeleteRow(parseInt(i, 10));
          }}
          onUpdate={newCondition => updateCondition(parseInt(i, 10), newCondition)}
        />
      ))}
      <StyledSelectControl
        options={options}
        onChange={(obj: any) => {
          onAddRow(obj.value);
        }}
        placeholder={placeholder}
        value={null}
      />
    </Fragment>
  );
}

const StyledSelectControl = styled(Select)`
  width: 100%;
`;
