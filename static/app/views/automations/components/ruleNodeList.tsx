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
  dataConditionTypes: DataConditionType[];
  group: string;
  onAddRow: (type: DataConditionType) => void;
  onDeleteRow: (id: number) => void;
  placeholder: string;
  updateCondition: (index: number, condition: Record<string, any>) => void;
}

export default function RuleNodeList({
  dataConditionTypes,
  group,
  placeholder,
  conditions,
  onAddRow,
  onDeleteRow,
  updateCondition,
}: RuleNodeListProps) {
  const options = Array.from(dataConditionNodesMap.entries())
    .map(([value, {label}]) => ({value, label}))
    .filter(({value}) => dataConditionTypes.includes(value));

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
