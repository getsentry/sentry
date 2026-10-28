import {Fragment, memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import {IconAdd} from '@sentry/icons/add';

import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {Select, components as selectComponents} from '@sentry/scraps/select';

import {t} from 'sentry/locale';
import {
  ActionGroup,
  ActionType,
  type Action,
  type ActionHandler,
} from 'sentry/types/workflowEngine/actions';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ActionNodeContext,
  useActionNodeContext,
} from 'sentry/views/automations/components/actionNodeContext';
import {actionNodesMap} from 'sentry/views/automations/components/actionNodes';
import {useAutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {AutomationBuilderRow} from 'sentry/views/automations/components/automationBuilderRow';
import {useAvailableActionsQuery} from 'sentry/views/automations/hooks';
import {useConnectedDetectors} from 'sentry/views/automations/hooks/useConnectedDetectors';
import {getIncompatibleActionWarnings} from 'sentry/views/automations/utils/getIncompatibleActionWarning';

interface ActionNodeListProps {
  actions: Action[];
  conditionGroupId: string;
  onAddRow: (actionHandler: ActionHandler) => void;
  onDeleteRow: (id: string) => void;
  placeholder: string;
  updateAction: (id: string, params: Record<string, any>) => void;
}

interface Option {
  label: string;
  value: ActionHandler;
}

function getActionHandler(
  action: Action,
  availableActions: ActionHandler[]
): ActionHandler | undefined {
  if (action.type === ActionType.SENTRY_APP) {
    return availableActions.find(handler => {
      if (handler.type !== ActionType.SENTRY_APP) {
        return false;
      }
      const {targetIdentifier} = action.config;
      const sentryApp = handler.sentryApp;

      return targetIdentifier === sentryApp?.id;
    });
  }
  return availableActions.find(handler => handler.type === action.type);
}

export function ActionNodeList({
  conditionGroupId,
  placeholder,
  actions,
  onAddRow,
  onDeleteRow,
  updateAction,
}: ActionNodeListProps) {
  const {data: availableActions = [], isLoading: isLoadingActions} =
    useAvailableActionsQuery();
  const {errors} = useAutomationBuilderErrorContext();
  const {state} = useAutomationBuilderContext();
  const triggerConditions = state.triggers.conditions;

  const options = useMemo(() => {
    const notificationActions: Option[] = [];
    const ticketCreationActions: Option[] = [];
    const otherActions: Option[] = [];

    availableActions.forEach(action => {
      if (action.type === ActionType.PLUGIN || action.disabledReason) {
        return;
      }
      const label =
        actionNodesMap.get(action.type)?.label || action.sentryApp?.name || action.type;
      const newAction = {
        value: action,
        label,
      };

      if (action.handlerGroup === ActionGroup.NOTIFICATION) {
        notificationActions.push(newAction);
      } else if (action.handlerGroup === ActionGroup.TICKET_CREATION) {
        ticketCreationActions.push(newAction);
      } else {
        otherActions.push(newAction);
      }
    });

    return [
      {
        key: ActionGroup.NOTIFICATION,
        label: t('Notifications'),
        options: notificationActions,
      },
      {
        key: ActionGroup.TICKET_CREATION,
        label: t('Ticket Creation'),
        options: ticketCreationActions,
      },
      {
        key: ActionGroup.OTHER,
        label: t('Other Integrations'),
        options: otherActions,
      },
    ];
  }, [availableActions]);

  return (
    <Fragment>
      {actions.map(action => {
        if (isLoadingActions) {
          return null;
        }
        const handler = getActionHandler(action, availableActions);
        if (!handler || handler.disabledReason) {
          const actionLabel = actionNodesMap.get(action.type)?.label;
          return (
            <AutomationBuilderRow
              key={`actionFilters.${conditionGroupId}.action.${action.id}`}
              onDelete={() => {
                onDeleteRow(action.id);
              }}
              hasError
              errorMessage={t(
                'This action is no longer available. Remove it to save changes.'
              )}
            >
              {actionLabel ?? t('Unknown integration')}
            </AutomationBuilderRow>
          );
        }
        return (
          <ActionNodeRow
            key={`actionFilters.${conditionGroupId}.action.${action.id}`}
            action={action}
            conditionGroupId={conditionGroupId}
            handler={handler}
            error={errors?.[action.id]}
            triggerConditions={triggerConditions}
            onDeleteRow={onDeleteRow}
            updateAction={updateAction}
          />
        );
      })}
      <AddActionSelect
        conditionGroupId={conditionGroupId}
        options={options}
        placeholder={placeholder}
        onAddRow={onAddRow}
      />
      {errors[conditionGroupId] && (
        <Alert variant="danger">{errors[conditionGroupId]}</Alert>
      )}
    </Fragment>
  );
}

interface ActionNodeRowProps {
  action: Action;
  conditionGroupId: string;
  handler: ActionHandler;
  onDeleteRow: (id: string) => void;
  triggerConditions: DataCondition[];
  updateAction: (id: string, params: Record<string, any>) => void;
  error?: string;
}

// Memoized so editing one action only re-renders that action's row
const ActionNodeRow = memo(function ActionNodeRow({
  action,
  conditionGroupId,
  handler,
  error,
  triggerConditions,
  onDeleteRow,
  updateAction,
}: ActionNodeRowProps) {
  const {connectedDetectors} = useConnectedDetectors();
  const warningMessages = getIncompatibleActionWarnings(action, {
    connectedDetectors,
    triggerConditions,
  });
  const actionId = `actionFilters.${conditionGroupId}.action.${action.id}`;
  const onUpdate = useCallback(
    (params: Record<string, any>) => updateAction(action.id, params),
    [updateAction, action.id]
  );
  const contextValue = useMemo(
    () => ({action, actionId, onUpdate, handler}),
    [action, actionId, onUpdate, handler]
  );

  return (
    <AutomationBuilderRow
      onDelete={() => {
        onDeleteRow(action.id);
      }}
      hasError={!!error}
      errorMessage={error}
      warningMessages={warningMessages}
    >
      <ActionNodeContext.Provider value={contextValue}>
        <Node />
      </ActionNodeContext.Provider>
    </AutomationBuilderRow>
  );
});

interface AddActionSelectProps {
  conditionGroupId: string;
  onAddRow: (actionHandler: ActionHandler) => void;
  options: Array<{key: ActionGroup; label: string; options: Option[]}>;
  placeholder: string;
}

const AddActionSelect = memo(function AddActionSelect({
  conditionGroupId,
  options,
  placeholder,
  onAddRow,
}: AddActionSelectProps) {
  const organization = useOrganization();
  const {removeError} = useAutomationBuilderErrorContext();
  const components = useMemo(
    () => ({
      Menu: ({children, ...props}: any) => (
        <selectComponents.Menu {...props}>
          <Fragment>
            {children}
            <Container padding="md" borderTop="muted">
              <LinkButton
                size="xs"
                variant="secondary"
                icon={<IconAdd />}
                href={`/settings/${organization.slug}/integrations/`}
                external
              >
                {t('Add another integration')}
              </LinkButton>
            </Container>
          </Fragment>
        </selectComponents.Menu>
      ),
    }),
    [organization.slug]
  );

  return (
    <StyledSelectControl
      aria-label={t('Add action')}
      options={options}
      onChange={(obj: any) => {
        onAddRow(obj.value);
        removeError(conditionGroupId);
      }}
      placeholder={placeholder}
      value={null}
      components={components}
    />
  );
});

function Node() {
  const {action} = useActionNodeContext();
  const node = actionNodesMap.get(action.type);

  const Component = node?.action;
  return Component ? <Component /> : node?.label;
}

const StyledSelectControl = styled(Select)`
  width: 100%;
`;
