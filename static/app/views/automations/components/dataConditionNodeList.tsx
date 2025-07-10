import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Checkbox} from 'sentry/components/core/checkbox';
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
  updateCondition: (id: string, params: {comparison?: any; type?: any}) => void;
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
    const otherOptions: Option[] = [];

    const percentageTypes = [
      DataConditionType.EVENT_FREQUENCY_PERCENT,
      DataConditionType.PERCENT_SESSIONS_PERCENT,
      DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
    ];

    dataConditionHandlers.forEach(handler => {
      if (
        percentageTypes.includes(handler.type) || // Skip percentage types so that frequency conditions are not duplicated
        handler.type === DataConditionType.ISSUE_PRIORITY_DEESCALATING // Skip issue priority deescalating condition since it is handled separately
      ) {
        return;
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
  }, [dataConditionHandlers, handlerGroup]);

  const issuePriorityDeescalatingConditionId: string | undefined = useMemo(() => {
    return conditions.find(
      condition => condition.type === DataConditionType.ISSUE_PRIORITY_DEESCALATING
    )?.id;
  }, [conditions]);

  const onIssuePriorityDeescalatingChange = () => {
    if (issuePriorityDeescalatingConditionId) {
      onDeleteRow(issuePriorityDeescalatingConditionId);
    } else {
      onAddRow(DataConditionType.ISSUE_PRIORITY_DEESCALATING);
    }
  };

  const onDeleteRowHandler = (condition: DataCondition) => {
    onDeleteRow(condition.id);

    // Count remaining ISSUE_PRIORITY_GREATER_OR_EQUAL conditions (excluding the one being deleted)
    const remainingPriorityConditions = conditions.filter(
      c =>
        c.type === DataConditionType.ISSUE_PRIORITY_GREATER_OR_EQUAL &&
        c.id !== condition.id
    ).length;

    // If no more ISSUE_PRIORITY_GREATER_OR_EQUAL conditions exist, remove the ISSUE_PRIORITY_DEESCALATING condition
    if (remainingPriorityConditions === 0 && issuePriorityDeescalatingConditionId) {
      onDeleteRow(issuePriorityDeescalatingConditionId);
    }
  };

  return (
    <Fragment>
      {conditions.map(
        condition =>
          // ISSUE_PRIORITY_DEESCALATING condition is a special case attached to the ISSUE_PRIORITY_GREATER_OR_EQUAL condition
          condition.type !== DataConditionType.ISSUE_PRIORITY_DEESCALATING && (
            <AutomationBuilderRow
              key={`${group}.conditions.${condition.id}`}
              onDelete={() => onDeleteRowHandler(condition)}
              hasError={conflictingConditionIds.includes(condition.id)}
            >
              <DataConditionNodeContext.Provider
                value={{
                  condition,
                  condition_id: `${group}.conditions.${condition.id}`,
                  onUpdate: params => updateCondition(condition.id, params),
                }}
              >
                <Node />
                {condition.type === DataConditionType.ISSUE_PRIORITY_GREATER_OR_EQUAL && (
                  <Fragment>
                    <Checkbox
                      checked={!!issuePriorityDeescalatingConditionId}
                      onChange={() => onIssuePriorityDeescalatingChange()}
                      aria-label={t('Notify on deescalation')}
                    />
                    {t('Notify on deescalation')}
                  </Fragment>
                )}
              </DataConditionNodeContext.Provider>
            </AutomationBuilderRow>
          )
      )}
      {/* Always show alert for conflicting action filters, but only show alert for triggers when the trigger conditions conflict with each other */}
      {((handlerGroup === DataConditionHandlerGroupType.ACTION_FILTER &&
        conflictingConditionIds.length > 0) ||
        conflictingConditionIds.length > 1) && (
        <Alert type="error">
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
        aria-label={t('Add condition')}
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
