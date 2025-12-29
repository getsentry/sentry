import {useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Select} from 'sentry/components/core/select';
import {ConditionBadge} from 'sentry/components/workflowEngine/ui/conditionBadge';
import {PurpleTextButton} from 'sentry/components/workflowEngine/ui/purpleTextButton';
import {IconAdd, IconDelete, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {
  DataConditionGroup,
  DataConditionGroupLogicType,
} from 'sentry/types/workflowEngine/dataConditions';
import {DataConditionHandlerGroupType} from 'sentry/types/workflowEngine/dataConditions';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {FILTER_MATCH_OPTIONS} from 'sentry/views/automations/components/actionFilters/constants';
import ActionNodeList from 'sentry/views/automations/components/actionNodeList';
import {AutomationBuilderConflictContext} from 'sentry/views/automations/components/automationBuilderConflictContext';
import {useAutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {
  stripActionFields,
  validateActions,
} from 'sentry/views/automations/components/automationFormData';
import DataConditionNodeList from 'sentry/views/automations/components/dataConditionNodeList';
import {TRIGGER_MATCH_OPTIONS} from 'sentry/views/automations/components/triggers/constants';
import {useSendTestNotification} from 'sentry/views/automations/hooks';
import {findConflictingConditions} from 'sentry/views/automations/hooks/utils';

export default function AutomationBuilder() {
  const {state, actions, showTriggerLogicTypeSelector} = useAutomationBuilderContext();
  const {mutationErrors} = useAutomationBuilderErrorContext();
  const organization = useOrganization();
  const api = useApi();

  // Fetch org members for SelectMembers dropdowns
  useEffect(() => {
    fetchOrgMembers(api, organization.slug);
  }, [api, organization]);

  const conflictData = useMemo(() => {
    return findConflictingConditions(state.triggers, state.actionFilters);
  }, [state]);

  return (
    <AutomationBuilderConflictContext.Provider value={conflictData}>
      <Flex direction="column" gap="md">
        <Step>
          <StepLead>
            {tct(
              '[when:When] an issue event is captured and [selector] of the following occur',
              {
                when: <ConditionBadge />,
                selector: showTriggerLogicTypeSelector ? (
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
                      name={`${state.triggers.id}.logicType`}
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
                ) : (
                  <strong>{t('any')}</strong>
                ),
              }
            )}
          </StepLead>
        </Step>
        <DataConditionNodeList
          handlerGroup={DataConditionHandlerGroupType.WORKFLOW_TRIGGER}
          label={t('Add trigger')}
          placeholder={t('Select a trigger...')}
          conditions={state.triggers.conditions}
          groupId={state.triggers.id}
          onAddRow={type => actions.addWhenCondition(type)}
          onDeleteRow={index => actions.removeWhenCondition(index)}
          updateCondition={(id, comparison) =>
            actions.updateWhenCondition(id, comparison)
          }
        />
        {(mutationErrors as any)?.actionFilters?.all && (
          <StyledAlert type="danger">
            {(mutationErrors as any).actionFilters.all}
          </StyledAlert>
        )}
        {state.actionFilters.map(actionFilter => (
          <ActionFilterBlock
            key={`actionFilters.${actionFilter.id}`}
            actionFilter={actionFilter}
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
    </AutomationBuilderConflictContext.Provider>
  );
}

interface ActionFilterBlockProps {
  actionFilter: DataConditionGroup;
}

function ActionFilterBlock({actionFilter}: ActionFilterBlockProps) {
  const {state, actions} = useAutomationBuilderContext();
  const {setErrors} = useAutomationBuilderErrorContext();
  const {mutate: sendTestNotification, isPending} = useSendTestNotification({
    onError: (error: RequestError) => {
      // Store test notification error in error context
      setErrors(prev => ({
        ...prev,
        ...error?.responseJSON,
      }));
    },
  });

  const numActionFilters = state.actionFilters.length;

  const handleSendTestNotification = useCallback(() => {
    const actionFilterActions = actionFilter.actions || [];

    // Validate actions before sending test notification
    const actionErrors = validateActions({actions: actionFilterActions});
    setErrors(prev => ({...prev, ...actionErrors}));

    // Only send test notification if there are no validation errors
    if (Object.keys(actionErrors).length === 0) {
      sendTestNotification(
        actionFilterActions.map(action => {
          return stripActionFields(action);
        })
      );
    }
  }, [actionFilter.actions, sendTestNotification, setErrors]);

  return (
    <IfThenWrapper>
      <Step>
        <Flex direction="column" gap="md">
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
          {numActionFilters > 1 && (
            <DeleteButton
              aria-label={t('Delete If/Then Block')}
              size="sm"
              icon={<IconDelete />}
              borderless
              onClick={() => actions.removeIf(actionFilter.id)}
              className="delete-condition-group"
            />
          )}
          <DataConditionNodeList
            handlerGroup={DataConditionHandlerGroupType.ACTION_FILTER}
            label={t('Add filter')}
            placeholder={t('Any event')}
            groupId={actionFilter.id}
            conditions={actionFilter?.conditions || []}
            onAddRow={type => actions.addIfCondition(actionFilter.id, type)}
            onDeleteRow={id => actions.removeIfCondition(actionFilter.id, id)}
            updateCondition={(id, params) =>
              actions.updateIfCondition(actionFilter.id, id, params)
            }
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
        <Button
          icon={<IconMail />}
          onClick={handleSendTestNotification}
          disabled={!actionFilter.actions?.length || isPending}
        >
          {t('Send Test Notification')}
        </Button>
      </span>
    </IfThenWrapper>
  );
}

const Step = styled(Flex)`
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
`;

const StepLead = styled(Flex)`
  align-items: center;
  gap: ${p => p.theme.space.xs};
  margin-bottom: ${p => p.theme.space.xs};
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
  position: relative;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.lg};
  margin-top: ${p => p.theme.space.md};

  /* Only hide delete button when hover is supported */
  @media (hover: hover) {
    &:not(:hover):not(:focus-within) {
      .delete-condition-group {
        ${p => p.theme.visuallyHidden}
      }
    }
  }
`;

const DeleteButton = styled(Button)`
  position: absolute;
  top: ${p => p.theme.space.sm};
  right: ${p => p.theme.space.sm};
`;

const StyledAlert = styled(Alert)`
  margin-top: ${p => p.theme.space.md};
`;
