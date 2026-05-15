import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';

import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {ConditionBadge} from 'sentry/components/workflowEngine/ui/conditionBadge';
import {IconDelete, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Action} from 'sentry/types/workflowEngine/actions';
import {
  DataConditionGroupLogicType,
  DataConditionHandlerGroupType,
  type DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useProjects} from 'sentry/utils/useProjects';
import {FILTER_MATCH_OPTIONS} from 'sentry/views/automations/components/actionFilters/constants';
import {ActionNodeList} from 'sentry/views/automations/components/actionNodeList';
import {useAutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {
  stripActionFields,
  validateActions,
} from 'sentry/views/automations/components/automationFormData';
import {DataConditionNodeList} from 'sentry/views/automations/components/dataConditionNodeList';
import {
  EmbeddedSelectField,
  Step,
  StepLead,
} from 'sentry/views/automations/components/stepComponents';
import {useSendTestNotification as useSendTestNotificationMutation} from 'sentry/views/automations/hooks';
import {useConnectedDetectors} from 'sentry/views/automations/hooks/useConnectedDetectors';

// We want the test notification to use a project that makes sense for alert config,
// so this selects the first project that is connected, and that the user has access to.
// If no project meets these criteria, we send nothing and the endpoint will default to a random project.
function useTestNotificationProjectSlug(): string | undefined {
  const formProjectIds = useFormField<string[]>('projectIds');
  const {connectedDetectors} = useConnectedDetectors();
  const {projects} = useProjects();

  const selectedProjectIds = new Set([
    ...(formProjectIds ?? []),
    ...connectedDetectors.map(d => d.projectId),
  ]);

  return projects.find(p => selectedProjectIds.has(p.id))?.slug;
}

function useSendTestNotification(actionFilterActions: Action[]) {
  const {setErrors} = useAutomationBuilderErrorContext();
  const projectSlug = useTestNotificationProjectSlug();

  const {mutate, isPending} = useSendTestNotificationMutation({
    onError: (error: RequestError) => {
      setErrors(prev => ({
        ...prev,
        ...error?.responseJSON,
      }));
    },
  });

  const sendTestNotification = () => {
    const actionErrors = validateActions({actions: actionFilterActions});
    setErrors(prev => ({...prev, ...actionErrors}));

    if (Object.keys(actionErrors).length === 0) {
      mutate({
        actions: actionFilterActions.map(action => stripActionFields(action)),
        projectSlug,
      });
    }
  };

  return {sendTestNotification, isPending};
}

interface ActionFilterBlockProps {
  actionFilter: DataConditionGroup;
}

export function ActionFilterBlock({actionFilter}: ActionFilterBlockProps) {
  const {state, actions} = useAutomationBuilderContext();
  const actionFilterActions = actionFilter.actions || [];
  const {sendTestNotification, isPending} = useSendTestNotification(actionFilterActions);
  const numActionFilters = state.actionFilters.length;

  return (
    <IfThenWrapper>
      <Step>
        <Flex direction="column" gap="md">
          <StepLead data-test-id="action-filter-logic-type">
            {tct('[if: If] [selector] of these filters match', {
              if: <ConditionBadge />,
              selector: (
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
                    name={`actionFilters.${actionFilter.id}.logicType`}
                    options={FILTER_MATCH_OPTIONS}
                    size="xs"
                    value={
                      FILTER_MATCH_OPTIONS.find(
                        choice =>
                          choice.value === actionFilter.logicType ||
                          choice.alias === actionFilter.logicType
                      )?.value || actionFilter.logicType
                    }
                    onChange={(option: SelectValue<DataConditionGroupLogicType>) =>
                      actions.updateIfLogicType(actionFilter.id, option.value)
                    }
                  />
                </Container>
              ),
            })}
          </StepLead>
          {numActionFilters > 1 && (
            <DeleteButton
              aria-label={t('Delete If/Then Block')}
              size="sm"
              icon={<IconDelete />}
              variant="transparent"
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
          onClick={sendTestNotification}
          disabled={!actionFilter.actions?.length || isPending}
        >
          {t('Send Test Notification')}
        </Button>
      </span>
    </IfThenWrapper>
  );
}

const IfThenWrapper = styled(Flex)`
  position: relative;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
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
