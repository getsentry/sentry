import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';
import type {
  DataConditionType,
  NewDataCondition,
} from 'sentry/types/workflowEngine/dataConditions';
import AutomationBuilderRow from 'sentry/views/automations/components/automationBuilderRow';
import {
  DataConditionNodeContext,
  dataConditionNodesMap,
  useDataConditionNodeContext,
} from 'sentry/views/automations/components/dataConditionNodes';

interface DataConditionNodeListProps {
  conditions: NewDataCondition[];
  dataConditionTypes: DataConditionType[];
  group: string;
  onAddRow: (type: DataConditionType) => void;
  onDeleteRow: (id: number) => void;
  placeholder: string;
  updateCondition: (index: number, condition: Record<string, any>) => void;
}

export default function DataConditionNodeList({
  dataConditionTypes,
  group,
  placeholder,
  conditions,
  onAddRow,
  onDeleteRow,
  updateCondition,
}: DataConditionNodeListProps) {
  const options = Array.from(dataConditionNodesMap.entries())
    .map(([value, {label}]) => ({value, label}))
    .filter(({value}) => dataConditionTypes.includes(value));

  return (
    <Fragment>
      {conditions.map((condition, i) => (
        <AutomationBuilderRow
          key={`${group}.conditions.${i}`}
          onDelete={() => onDeleteRow(i)}
        >
          <DataConditionNodeContext.Provider
            value={{
              condition,
              condition_id: `${group}.conditions.${i}`,
              onUpdate: newCondition => updateCondition(i, newCondition),
            }}
          >
            <Node />
          </DataConditionNodeContext.Provider>
        </AutomationBuilderRow>
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

function Node() {
  const {condition} = useDataConditionNodeContext();
  const node = dataConditionNodesMap.get(condition.comparison_type);

  const Component = node?.dataCondition;
  return Component ? Component : node?.label;
}

const StyledSelectControl = styled(Select)`
  width: 100%;
`;
