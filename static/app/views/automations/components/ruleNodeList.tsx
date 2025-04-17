import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';
import type {
  DataConditionType,
  NewDataCondition,
} from 'sentry/types/workflowEngine/dataConditions';
import {dataConditionNodesMap} from 'sentry/views/automations/components/dataConditionNodes';
import RuleNode from 'sentry/views/automations/components/ruleNode';

interface RuleNodeListProps {
  conditions: NewDataCondition[];
  group: string;
  onAddRow: (type: DataConditionType) => void;
  onDeleteRow: (id: number) => void;
  placeholder: string;
  updateCondition: (index: number, condition: Record<string, any>) => void;
}

// TODO: only show data conditions that are returned by the API
const options = Array.from(dataConditionNodesMap, ([key, value]) => ({
  value: key,
  label: value.label,
}));

export default function RuleNodeList({
  group,
  placeholder,
  conditions,
  onAddRow,
  onDeleteRow,
  updateCondition,
}: RuleNodeListProps) {
  return (
    <Fragment>
      {conditions.map((condition, i) => (
        <RuleNode
          key={`${group}.conditions.${i}`}
          condition_id={`${group}.conditions.${i}`}
          condition={condition}
          onDelete={() => {
            onDeleteRow(i);
          }}
          onUpdate={newCondition => updateCondition(i, newCondition)}
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
