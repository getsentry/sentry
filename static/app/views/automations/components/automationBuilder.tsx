import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Select} from 'sentry/components/core/select';
import {ConditionBadge} from 'sentry/components/workflowEngine/ui/conditionBadge';
import {PurpleTextButton} from 'sentry/components/workflowEngine/ui/purpleTextButton';
import {IconAdd, IconDelete, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {
  ConflictingConditions,
  DataConditionGroup,
  DataConditionGroupLogicType,
} from 'sentry/types/workflowEngine/dataConditions';
import {DataConditionHandlerGroupType} from 'sentry/types/workflowEngine/dataConditions';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {FILTER_MATCH_OPTIONS} from 'sentry/views/automations/components/actionFilters/constants';
import ActionNodeList from 'sentry/views/automations/components/actionNodeList';
import {useAutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import DataConditionNodeList from 'sentry/views/automations/components/dataConditionNodeList';
import {TRIGGER_MATCH_OPTIONS} from 'sentry/views/automations/components/triggers/constants';
import {findConflictingConditions} from 'sentry/views/automations/hooks/utils';

export default function AutomationBuilder() {
  const {state, actions} = useAutomationBuilderContext();
  const organization = useOrganization();
  const api = useApi();

  // Fetch org members for SelectMembers dropdowns
  useEffect(() => {
    fetchOrgMembers(api, organization.slug);
  }, [api, organization]);

  const {conflictingTriggers, conflictingActionFilters} =
    useMemo((): ConflictingConditions => {
      return findConflictingConditions(state.triggers, state.actionFilters);
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
                  onChange={(option: SelectValue<DataConditionGroupLogicType>) =>
                    actions.updateWhenLogicType(option.value)
                  }
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
        conflictingConditionIds={conflictingTriggers}
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
                      onChange={(option: SelectValue<DataConditionGroupLogicType>) =>
                        actions.updateIfLogicType(actionFilter.id, option.value)
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
            updateCondition={(id, params) =>
              actions.updateIfCondition(actionFilter.id, id, params)
            }
            conflictingConditionIds={conflictingConditions}
          />
        </Flex>
      </Step>
      <Step>
        <StepLead>
          {tct('[then:Then] perform these actions', {
            then: <ConditionBadge />,
          })}
        </StepLead>
        <ActionNodeList
          placeholder={t('Select an action')}
          conditionGroupId={actionFilter.id}
          actions={actionFilter?.actions || []}
          onAddRow={handler => actions.addIfAction(actionFilter.id, handler)}
          onDeleteRow={id => actions.removeIfAction(actionFilter.id, id)}
          updateAction={(id, data) => actions.updateIfAction(actionFilter.id, id, data)}
        />
      </Step>
      <span>
        <Button icon={<IconMail />}>{t('Send Test Notification')}</Button>
      </span>
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

const EmbeddedSelectField = styled(Select)`
  padding: 0;
  font-weight: ${p => p.theme.fontWeight.normal};
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
