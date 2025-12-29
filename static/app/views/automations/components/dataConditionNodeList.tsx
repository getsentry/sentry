import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Select} from 'sentry/components/core/select';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionHandlerGroupType,
  DataConditionHandlerSubgroupType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {useAutomationBuilderConflictContext} from 'sentry/views/automations/components/automationBuilderConflictContext';
import {useAutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import AutomationBuilderRow from 'sentry/views/automations/components/automationBuilderRow';
import {
  DataConditionNodeContext,
  dataConditionNodesMap,
  useDataConditionNodeContext,
} from 'sentry/views/automations/components/dataConditionNodes';
import {useDataConditionsQuery} from 'sentry/views/automations/hooks';

interface DataConditionNodeListProps {
  conditions: DataCondition[];
  groupId: string;
  handlerGroup: DataConditionHandlerGroupType;
  label: string;
  onAddRow: (type: DataConditionType) => void;
  onDeleteRow: (id: string) => void;
  placeholder: string;
  updateCondition: (id: string, params: {comparison?: any; type?: any}) => void;
}

interface Option {
  label: string;
  value: DataConditionType;
  disabled?: boolean;
}

export default function DataConditionNodeList({
  handlerGroup,
  groupId,
  placeholder,
  label,
  conditions,
  onAddRow,
  onDeleteRow,
  updateCondition,
}: DataConditionNodeListProps) {
  const {data: dataConditionHandlers = []} = useDataConditionsQuery(handlerGroup);
  const {conflictingConditionGroups, conflictReason} =
    useAutomationBuilderConflictContext();
  const conflictingConditions = conflictingConditionGroups[groupId];
  const {errors} = useAutomationBuilderErrorContext();
  const {state} = useAutomationBuilderContext();

  const options = useMemo(() => {
    if (handlerGroup === DataConditionHandlerGroupType.WORKFLOW_TRIGGER) {
      // Get the types of already selected trigger conditions
      const selectedTriggerTypes = new Set(
        state.triggers.conditions.map(condition => condition.type)
      );

      // Filter out already selected trigger condition types
      return dataConditionHandlers
        .filter(handler => !selectedTriggerTypes.has(handler.type))
        .map(handler => ({
          value: handler.type,
          label: dataConditionNodesMap.get(handler.type)?.label || handler.type,
        }));
    }

    const issueAttributeOptions: Option[] = [];
    const frequencyOptions: Option[] = [];
    const eventAttributeOptions: Option[] = [];
    const otherOptions: Option[] = [];

    const percentageTypes = [
      DataConditionType.EVENT_FREQUENCY_PERCENT,
      DataConditionType.PERCENT_SESSIONS_PERCENT,
      DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
    ];

    dataConditionHandlers.forEach(handler => {
      // Skip percentage types so that frequency conditions are not duplicated
      if (percentageTypes.includes(handler.type)) {
        return;
      }

      const conditionType = frequencyTypeMapping[handler.type] || handler.type;
      const conditionLabel = dataConditionNodesMap.get(conditionType)?.label;
      const WarningMessage = dataConditionNodesMap.get(conditionType)?.warningMessage;

      const newDataCondition: Option = {
        value: conditionType,
        label: conditionLabel || handler.type,
        ...(WarningMessage && {
          trailingItems: (
            <Tooltip title={<WarningMessage />}>
              <IconWarning />
            </Tooltip>
          ),
        }),
      };

      if (handler.handlerSubgroup === DataConditionHandlerSubgroupType.EVENT_ATTRIBUTES) {
        eventAttributeOptions.push(newDataCondition);
      } else if (handler.handlerSubgroup === DataConditionHandlerSubgroupType.FREQUENCY) {
        frequencyOptions.push(newDataCondition);
      } else if (
        handler.handlerSubgroup === DataConditionHandlerSubgroupType.ISSUE_ATTRIBUTES
      ) {
        issueAttributeOptions.push(newDataCondition);
      } else {
        otherOptions.push(newDataCondition);
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
      {
        key: 'other',
        label: t('Other'),
        options: otherOptions,
      },
    ];
  }, [dataConditionHandlers, handlerGroup, state.triggers.conditions]);

  return (
    <Fragment>
      {conditions.map(condition => {
        const error = errors?.[condition.id];

        return (
          <AutomationBuilderRow
            key={condition.id}
            onDelete={() => onDeleteRow(condition.id)}
            hasError={conflictingConditions?.has(condition.id) || !!error}
            errorMessage={error}
          >
            <DataConditionNodeContext.Provider
              value={{
                condition,
                condition_id: condition.id,
                onUpdate: params => updateCondition(condition.id, params),
              }}
            >
              <Node />
            </DataConditionNodeContext.Provider>
          </AutomationBuilderRow>
        );
      })}
      {/* Always show alert for conflicting action filters, but only show alert for triggers when the trigger conditions conflict with each other */}
      {conflictingConditions &&
        ((handlerGroup === DataConditionHandlerGroupType.ACTION_FILTER &&
          conflictingConditions.size > 0) ||
          conflictingConditions.size > 1) && (
          <Alert variant="danger">{conflictReason}</Alert>
        )}
      {/* Only show dropdown if there are available options */}
      {options.length > 0 && (
        <StyledSelectControl
          options={options}
          onChange={(obj: any) => {
            onAddRow(obj.value);
          }}
          placeholder={placeholder}
          value={null}
          aria-label={label}
        />
      )}
    </Fragment>
  );
}

function Node() {
  const {condition} = useDataConditionNodeContext();
  const node = dataConditionNodesMap.get(condition.type);

  const Component = node?.dataCondition;
  return Component ? <Component /> : node?.label;
}

/**
 * Maps COUNT and PERCENT frequency conditions to their base frequency type.
 * This is used in the UI to show both conditions as a single branching condition.
 */
const frequencyTypeMapping: Partial<Record<DataConditionType, DataConditionType>> = {
  [DataConditionType.PERCENT_SESSIONS_COUNT]: DataConditionType.PERCENT_SESSIONS,
  [DataConditionType.PERCENT_SESSIONS_PERCENT]: DataConditionType.PERCENT_SESSIONS,
  [DataConditionType.EVENT_FREQUENCY_COUNT]: DataConditionType.EVENT_FREQUENCY,
  [DataConditionType.EVENT_FREQUENCY_PERCENT]: DataConditionType.EVENT_FREQUENCY,
  [DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT]:
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY,
  [DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT]:
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY,
};

const StyledSelectControl = styled(Select)`
  width: 100%;
`;
