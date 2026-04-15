import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Container, Flex} from '@sentry/scraps/layout';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {ConditionBadge} from 'sentry/components/workflowEngine/ui/conditionBadge';
import {PurpleTextButton} from 'sentry/components/workflowEngine/ui/purpleTextButton';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {
  DataConditionGroupLogicType,
  DataConditionHandlerGroupType,
} from 'sentry/types/workflowEngine/dataConditions';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ActionFilterBlock} from 'sentry/views/automations/components/actionFilterBlock';
import {AutomationBuilderConflictContext} from 'sentry/views/automations/components/automationBuilderConflictContext';
import {useAutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {DataConditionNodeList} from 'sentry/views/automations/components/dataConditionNodeList';
import {
  EmbeddedSelectField,
  Step,
  StepLead,
} from 'sentry/views/automations/components/stepComponents';
import {TRIGGER_MATCH_OPTIONS} from 'sentry/views/automations/components/triggers/constants';
import {findConflictingConditions} from 'sentry/views/automations/hooks/utils';

export function AutomationBuilder() {
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
                  <Container width="80px">
                    <EmbeddedSelectField
                      styles={{
                        control: (provided: any) => ({
                          ...provided,
                          minHeight: '21px',
                          height: '21px',
                        }),
                      }}
                      isSearchable={false}
                      isClearable={false}
                      name={`${state.triggers.id}.logicType`}
                      value={
                        // We do not expose ANY as a valid option, but it is
                        state.triggers.logicType === DataConditionGroupLogicType.ANY
                          ? DataConditionGroupLogicType.ANY_SHORT_CIRCUIT
                          : state.triggers.logicType
                      }
                      onChange={(option: SelectValue<DataConditionGroupLogicType>) =>
                        actions.updateWhenLogicType(option.value)
                      }
                      options={TRIGGER_MATCH_OPTIONS}
                      size="xs"
                    />
                  </Container>
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
          <StyledAlert variant="danger">
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
            priority="transparent"
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

const StyledAlert = styled(Alert)`
  margin-top: ${p => p.theme.space.md};
`;
