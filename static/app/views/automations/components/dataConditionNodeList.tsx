import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';
import type {
  DataCondition,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import AutomationBuilderRow from 'sentry/views/automations/components/automationBuilderRow';
import {
  DataConditionNodeContext,
  dataConditionNodesMap,
  useDataConditionNodeContext,
} from 'sentry/views/automations/components/dataConditionNodes';

interface DataConditionNodeListProps {
  conditions: DataCondition[];
  dataConditionTypes: DataConditionType[];
  group: string;
  onAddRow: (type: DataConditionType) => void;
  onDeleteRow: (id: string) => void;
  placeholder: string;
  updateCondition: (id: string, condition: Record<string, any>) => void;
  updateConditionType?: (id: string, type: DataConditionType) => void;
}

export default function DataConditionNodeList({
  dataConditionTypes,
  group,
  placeholder,
  conditions,
  onAddRow,
  onDeleteRow,
  updateCondition,
  updateConditionType,
}: DataConditionNodeListProps) {
  const options = Array.from(dataConditionNodesMap.entries())
    .map(([value, {label}]) => ({value, label}))
    .filter(({value}) => dataConditionTypes.includes(value));

  return (
    <Fragment>
      {conditions.map(condition => (
        <AutomationBuilderRow
          key={`${group}.conditions.${condition.id}`}
          onDelete={() => onDeleteRow(condition.id)}
        >
          <DataConditionNodeContext.Provider
            value={{
              condition,
              condition_id: `${group}.conditions.${condition.id}`,
              onUpdate: newCondition => updateCondition(condition.id, newCondition),
              onUpdateType: type =>
                updateConditionType && updateConditionType(condition.id, type),
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
