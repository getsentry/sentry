import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Select} from 'sentry/components/core/select';
import {t} from 'sentry/locale';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionHandlerGroupType,
  DataConditionHandlerSubgroupType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import AutomationBuilderRow from 'sentry/views/automations/components/automationBuilderRow';
import {
  DataConditionNodeContext,
  dataConditionNodesMap,
  frequencyTypeMapping,
  useDataConditionNodeContext,
} from 'sentry/views/automations/components/dataConditionNodes';
import {useDataConditionsQuery} from 'sentry/views/automations/hooks';

interface DataConditionNodeListProps {
  conditions: DataCondition[];
  conflictingConditionIds: string[];
  group: string;
  handlerGroup: DataConditionHandlerGroupType;
  onAddRow: (type: DataConditionType) => void;
  onDeleteRow: (id: string) => void;
  placeholder: string;
  updateCondition: (id: string, condition: Record<string, any>) => void;
  updateConditionType?: (id: string, type: DataConditionType) => void;
}

interface Option {
  label: string;
  value: DataConditionType;
}

export default function DataConditionNodeList({
  handlerGroup,
  group,
  placeholder,
  conditions,
  onAddRow,
  onDeleteRow,
  updateCondition,
  updateConditionType,
  conflictingConditionIds,
}: DataConditionNodeListProps) {
  const {data: dataConditionHandlers = []} = useDataConditionsQuery(handlerGroup);

  const options = useMemo(() => {
    if (handlerGroup === DataConditionHandlerGroupType.WORKFLOW_TRIGGER) {
      return dataConditionHandlers.map(handler => ({
        value: handler.type,
        label: dataConditionNodesMap.get(handler.type)?.label || handler.type,
      }));
    }

    const issueAttributeOptions: Option[] = [];
    const frequencyOptions: Option[] = [];
    const eventAttributeOptions: Option[] = [];

    const percentageTypes = [
      DataConditionType.EVENT_FREQUENCY_PERCENT,
      DataConditionType.PERCENT_SESSIONS_PERCENT,
      DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
    ];

    dataConditionHandlers.forEach(handler => {
      if (percentageTypes.includes(handler.type)) {
        return; // Skip percentage types so that frequency conditions are not duplicated
      }

      const conditionType = frequencyTypeMapping[handler.type] || handler.type;

      const newDataCondition: Option = {
        value: conditionType,
        label: dataConditionNodesMap.get(handler.type)?.label || handler.type,
      };

      if (handler.handlerSubgroup === DataConditionHandlerSubgroupType.EVENT_ATTRIBUTES) {
        eventAttributeOptions.push(newDataCondition);
      } else if (handler.handlerSubgroup === DataConditionHandlerSubgroupType.FREQUENCY) {
        frequencyOptions.push(newDataCondition);
      } else if (
        handler.handlerSubgroup === DataConditionHandlerSubgroupType.ISSUE_ATTRIBUTES
      ) {
        issueAttributeOptions.push(newDataCondition);
      }
    });

    return [
      {
        key: DataConditionHandlerSubgroupType.ISSUE_ATTRIBUTES,
        label: t('Filter by Issue Attributes'),
        options: issueAttributeOptions,
      },
      {
        key: DataConditionHandlerSubgroupType.FREQUENCY,
        label: t('Filter by Frequency'),
        options: frequencyOptions,
      },
      {
        key: DataConditionHandlerSubgroupType.EVENT_ATTRIBUTES,
        label: t('Filter by Event Attributes'),
        options: eventAttributeOptions,
      },
    ];
  }, [dataConditionHandlers, handlerGroup]);

  return (
    <Fragment>
      {conditions.map(condition => (
        <AutomationBuilderRow
          key={`${group}.conditions.${condition.id}`}
          onDelete={() => onDeleteRow(condition.id)}
          isConflicting={conflictingConditionIds.includes(condition.id)}
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
      {/* Always show alert for conflicting action filters, but only show alert for triggers when the trigger conditions conflict with each other */}
      {((handlerGroup === DataConditionHandlerGroupType.ACTION_FILTER &&
        conflictingConditionIds.length > 0) ||
        conflictingConditionIds.length > 1) && (
        <Alert type="error" showIcon>
          {t(
            'The conditions highlighted in red are in conflict.  They may prevent the alert from ever being triggered.'
          )}
        </Alert>
      )}
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
  const node = dataConditionNodesMap.get(condition.type);

  const Component = node?.dataCondition;
  return Component ? <Component /> : node?.label;
}

const StyledSelectControl = styled(Select)`
  width: 100%;
`;
