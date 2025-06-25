import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import SelectField from 'sentry/components/forms/fields/selectField';
import {ConditionBadge} from 'sentry/components/workflowEngine/ui/conditionBadge';
import {PurpleTextButton} from 'sentry/components/workflowEngine/ui/purpleTextButton';
import {IconAdd, IconDelete, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataConditionGroup} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionGroupLogicType,
  DataConditionHandlerGroupType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AgeComparison,
  FILTER_MATCH_OPTIONS,
} from 'sentry/views/automations/components/actionFilters/constants';
import ActionNodeList from 'sentry/views/automations/components/actionNodeList';
import {useAutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import DataConditionNodeList from 'sentry/views/automations/components/dataConditionNodeList';
import {TRIGGER_MATCH_OPTIONS} from 'sentry/views/automations/components/triggers/constants';

const frequencyTypes = [
  DataConditionType.EVENT_FREQUENCY_COUNT,
  DataConditionType.EVENT_FREQUENCY_PERCENT,
  DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
  DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
];

function findConflictingActionFilterConditions(
  actionFilter: DataConditionGroup
): string[] {
  const incompatibleConditions = [];

  // Find incompatible conditions for NONE logic type
  if (actionFilter.logicType === DataConditionGroupLogicType.NONE) {
    for (const condition of actionFilter.conditions) {
      const isInvalidAgeComparison =
        condition.type === DataConditionType.AGE_COMPARISON &&
        condition.comparison.comparison_type === AgeComparison.NEWER &&
        condition.comparison.value > 0;
      const isInvalidIssueOccurence =
        condition.type === DataConditionType.ISSUE_OCCURRENCES &&
        condition.comparison.value <= 1;

      if (isInvalidAgeComparison || isInvalidIssueOccurence) {
        incompatibleConditions.push(condition.id);
      }
      return incompatibleConditions;
    }
  }

  // Find incompatible conditions for ANY_SHORT_CIRCUIT and ALL logic types
  for (const condition of actionFilter.conditions) {
    const isInvalidFrequency =
      frequencyTypes.includes(condition.type) && condition.comparison.value >= 1;
    const isInvalidAgeComparison =
      condition.type === DataConditionType.AGE_COMPARISON &&
      condition.comparison.comparison_type === AgeComparison.OLDER;
    const isInvalidIssueOccurence =
      condition.type === DataConditionType.ISSUE_OCCURRENCES &&
      condition.comparison.value > 1;

    if (isInvalidFrequency || isInvalidAgeComparison || isInvalidIssueOccurence) {
      incompatibleConditions.push(condition.id);
    }
  }

  // If the logic type is ANY_SHORT_CIRCUIT and any of the conditions are valid, consider the action filter valid
  if (
    actionFilter.logicType === DataConditionGroupLogicType.ANY_SHORT_CIRCUIT &&
    incompatibleConditions.length !== actionFilter.conditions.length
  ) {
    return [];
  }

  return incompatibleConditions;
}

export default function AutomationBuilder() {
  const {state, actions} = useAutomationBuilderContext();
  const organization = useOrganization();
  const api = useApi();

  // Fetch org members for SelectMembers dropdowns
  useEffect(() => {
    fetchOrgMembers(api, organization.slug);
  }, [api, organization]);

  const {conflictingTriggers, conflictingActionFilters} = useMemo((): {
    conflictingActionFilters: Record<string, string[]>;
    conflictingTriggers: string[];
  } => {
    // First check for conflicting trigger conditions
    if (state.triggers.logicType === 'all' && state.triggers.conditions.length > 1) {
      return {
        conflictingTriggers: state.triggers.conditions.map(condition => condition.id),
        conflictingActionFilters: {},
      };
    }

    // Check for first seen event condition
    const firstSeenId = state.triggers.conditions.find(
      condition => condition.type === DataConditionType.FIRST_SEEN_EVENT
    )?.id;

    const conflictingConditions: Record<string, string[]> = {};
    let hasConflictingActionFilters = false;

    // First seen event condition does not cause conflicts if the logic type is ANY_SHORT_CIRCUIT and there are multiple trigger conditions
    if (
      firstSeenId &&
      !(
        state.triggers.logicType === DataConditionGroupLogicType.ANY_SHORT_CIRCUIT &&
        state.triggers.conditions.length > 1
      )
    ) {
      // Create a mapping of conflicting conditions for each action filter
      for (const actionFilter of state.actionFilters) {
        const conflicts = findConflictingActionFilterConditions(actionFilter);
        conflictingConditions[actionFilter.id] = conflicts;
        if (conflicts.length > 0) {
          hasConflictingActionFilters = true;
        }
      }
      // First seen event is only conflicting if there are conflicting action filter conditions
      if (hasConflictingActionFilters) {
        return {
          conflictingTriggers: [firstSeenId],
          conflictingActionFilters: conflictingConditions,
        };
      }
    }
    return {
      conflictingTriggers: [],
      conflictingActionFilters: {},
    };
  }, [state]);

  return (
    <Flex direction="column" gap={space(1)}>
      <Step>
        <StepLead>
          {/* TODO: Only make this a selector of "all" is originally selected */}
          {tct('[when:When] [selector] of the following occur', {
            when: <ConditionBadge />,
            selector: (
              <EmbeddedWrapper>
                <EmbeddedSelectField
                  styles={{
                    control: (provided: any) => ({
                      ...provided,
                      minHeight: '21px',
                      height: '21px',
                    }),
                  }}
                  inline={false}
                  isSearchable={false}
                  isClearable={false}
                  name="triggers.logicType"
                  value={state.triggers.logicType}
                  onChange={logicType => actions.updateWhenLogicType(logicType)}
                  required
                  flexibleControlStateSize
                  options={TRIGGER_MATCH_OPTIONS}
                  size="xs"
                />
              </EmbeddedWrapper>
            ),
          })}
        </StepLead>
      </Step>
      <DataConditionNodeList
        handlerGroup={DataConditionHandlerGroupType.WORKFLOW_TRIGGER}
        placeholder={t('Select a trigger...')}
        conditions={state.triggers.conditions}
        group="triggers"
        onAddRow={type => actions.addWhenCondition(type)}
        onDeleteRow={index => actions.removeWhenCondition(index)}
        updateCondition={(id, comparison) => actions.updateWhenCondition(id, comparison)}
        conflictingConditions={conflictingTriggers}
      />
      {state.actionFilters.map(actionFilter => (
        <ActionFilterBlock
          key={`actionFilters.${actionFilter.id}`}
          actionFilter={actionFilter}
          conflictingConditions={conflictingActionFilters[actionFilter.id] || []}
        />
      ))}
      <span>
        <PurpleTextButton
          borderless
          icon={<IconAdd />}
          size="xs"
          onClick={() => actions.addIf()}
        >
          {t('If/Then Block')}
        </PurpleTextButton>
      </span>
      <span>
        <Button icon={<IconMail />}>{t('Send Test Notification')}</Button>
      </span>
    </Flex>
  );
}

interface ActionFilterBlockProps {
  actionFilter: DataConditionGroup;
  conflictingConditions: string[];
}

function ActionFilterBlock({
  actionFilter,
  conflictingConditions = [],
}: ActionFilterBlockProps) {
  const {actions} = useAutomationBuilderContext();

  return (
    <IfThenWrapper>
      <Step>
        <Flex direction="column" gap={space(0.75)}>
          <Flex justify="space-between">
            <StepLead>
              {tct('[if: If] [selector] of these filters match', {
                if: <ConditionBadge />,
                selector: (
                  <EmbeddedWrapper>
                    <EmbeddedSelectField
                      styles={{
                        control: (provided: any) => ({
                          ...provided,
                          minHeight: '21px',
                          height: '21px',
                        }),
                      }}
                      inline={false}
                      isSearchable={false}
                      isClearable={false}
                      name={`actionFilters.${actionFilter.id}.logicType`}
                      required
                      flexibleControlStateSize
                      options={FILTER_MATCH_OPTIONS}
                      size="xs"
                      value={actionFilter.logicType}
                      onChange={value =>
                        actions.updateIfLogicType(actionFilter.id, value)
                      }
                    />
                  </EmbeddedWrapper>
                ),
              })}
            </StepLead>
            <Button
              aria-label={t('Delete If/Then Block')}
              size="sm"
              icon={<IconDelete />}
              borderless
              onClick={() => actions.removeIf(actionFilter.id)}
              className="delete-condition-group"
            />
          </Flex>
          <DataConditionNodeList
            handlerGroup={DataConditionHandlerGroupType.ACTION_FILTER}
            placeholder={t('Filter by...')}
            group={`actionFilters.${actionFilter.id}`}
            conditions={actionFilter?.conditions || []}
            onAddRow={type => actions.addIfCondition(actionFilter.id, type)}
            onDeleteRow={id => actions.removeIfCondition(actionFilter.id, id)}
            updateCondition={(id, comparison) =>
              actions.updateIfCondition(actionFilter.id, id, comparison)
            }
            updateConditionType={(id, type) =>
              actions.updateIfConditionType(actionFilter.id, id, type)
            }
            conflictingConditions={conflictingConditions}
          />
        </Flex>
      </Step>
      <Step>
        <StepLead>
          {tct('[then:Then] perform these actions', {
            then: <ConditionBadge />,
          })}
        </StepLead>
        {/* TODO: add actions dropdown here */}
        <ActionNodeList
          placeholder={t('Select an action')}
          group={`actionFilters.${actionFilter.id}`}
          actions={actionFilter?.actions || []}
          onAddRow={(id, type) => actions.addIfAction(actionFilter.id, id, type)}
          onDeleteRow={id => actions.removeIfAction(actionFilter.id, id)}
          updateAction={(id, data) => actions.updateIfAction(actionFilter.id, id, data)}
        />
      </Step>
    </IfThenWrapper>
  );
}

const Step = styled(Flex)`
  flex-direction: column;
  gap: ${space(0.75)};
`;

const StepLead = styled(Flex)`
  align-items: center;
  gap: ${space(0.5)};
`;

const EmbeddedSelectField = styled(SelectField)`
  padding: 0;
  font-weight: ${p => p.theme.fontWeightNormal};
  text-transform: none;
`;

const EmbeddedWrapper = styled('div')`
  width: 80px;
`;

const IfThenWrapper = styled(Flex)`
  flex-direction: column;
  gap: ${space(1.5)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)};
  padding-top: ${space(1)};
  margin-top: ${space(1)};

  .delete-condition-group {
    opacity: 0;
  }
  :hover .delete-condition-group {
    opacity: 1;
  }
`;
