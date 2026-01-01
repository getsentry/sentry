import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Select} from 'sentry/components/core/select';
import {t} from 'sentry/locale';
import {
  ActionGroup,
  ActionType,
  SentryAppIdentifier,
  type Action,
  type ActionHandler,
} from 'sentry/types/workflowEngine/actions';
import {
  ActionNodeContext,
  actionNodesMap,
  useActionNodeContext,
} from 'sentry/views/automations/components/actionNodes';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import AutomationBuilderRow from 'sentry/views/automations/components/automationBuilderRow';
import {useAvailableActionsQuery} from 'sentry/views/automations/hooks';

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
      const {sentryAppIdentifier, targetIdentifier} = action.config;
      const sentryApp = handler.sentryApp;

      const isMatchingAppId =
        sentryAppIdentifier === SentryAppIdentifier.SENTRY_APP_ID &&
        targetIdentifier === sentryApp?.id;
      const isMatchingInstallationUuid =
        sentryAppIdentifier === SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID &&
        targetIdentifier === sentryApp?.installationUuid;
      return isMatchingAppId || isMatchingInstallationUuid;
    });
  }
  return availableActions.find(handler => handler.type === action.type);
}

export default function ActionNodeList({
  conditionGroupId,
  placeholder,
  actions,
  onAddRow,
  onDeleteRow,
  updateAction,
}: ActionNodeListProps) {
  const {data: availableActions = []} = useAvailableActionsQuery();
  const {errors, removeError} = useAutomationBuilderErrorContext();

  const options = useMemo(() => {
    const notificationActions: Option[] = [];
    const ticketCreationActions: Option[] = [];
    const otherActions: Option[] = [];

    availableActions.forEach(action => {
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
        const handler = getActionHandler(action, availableActions);
        if (!handler) {
          return null;
        }
        const error = errors?.[action.id];
        return (
          <AutomationBuilderRow
            key={`actionFilters.${conditionGroupId}.action.${action.id}`}
            onDelete={() => {
              onDeleteRow(action.id);
            }}
            hasError={!!error}
            errorMessage={error}
          >
            <ActionNodeContext.Provider
              value={{
                action,
                actionId: `actionFilters.${conditionGroupId}.action.${action.id}`,
                onUpdate: newAction => updateAction(action.id, newAction),
                handler,
              }}
            >
              <Node />
            </ActionNodeContext.Provider>
          </AutomationBuilderRow>
        );
      })}
      <StyledSelectControl
        aria-label={t('Add action')}
        options={options}
        onChange={(obj: any) => {
          onAddRow(obj.value);
          removeError(conditionGroupId);
        }}
        placeholder={placeholder}
        value={null}
      />
      {errors[conditionGroupId] && (
        <Alert variant="danger">{errors[conditionGroupId]}</Alert>
      )}
    </Fragment>
  );
}

function Node() {
  const {action} = useActionNodeContext();
  const node = actionNodesMap.get(action.type);

  const Component = node?.action;
  return Component ? <Component /> : node?.label;
}

const StyledSelectControl = styled(Select)`
  width: 100%;
`;
