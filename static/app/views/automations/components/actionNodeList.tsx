import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {uuid4} from '@sentry/core';

import {Select} from 'sentry/components/core/select';
import {t} from 'sentry/locale';
import {
  type Action,
  ActionGroup,
  type ActionHandler,
} from 'sentry/types/workflowEngine/actions';
import {
  ActionNodeContext,
  actionNodesMap,
  useActionNodeContext,
} from 'sentry/views/automations/components/actionNodes';
import AutomationBuilderRow from 'sentry/views/automations/components/automationBuilderRow';
import {useAvailableActionsQuery} from 'sentry/views/automations/hooks';

interface ActionNodeListProps {
  actions: Action[];
  group: string;
  onAddRow: (actionId: string, actionHandler: ActionHandler) => void;
  onDeleteRow: (id: string) => void;
  placeholder: string;
  updateAction: (id: string, params: Record<string, any>) => void;
}

interface Option {
  label: string;
  value: ActionHandler;
}

export default function ActionNodeList({
  group,
  placeholder,
  actions,
  onAddRow,
  onDeleteRow,
  updateAction,
}: ActionNodeListProps) {
  const {data: availableActions = []} = useAvailableActionsQuery();
  const [actionHandlerMap, setActionHandlerMap] = useState<Record<string, ActionHandler>>(
    {}
  );

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
        const handler = actionHandlerMap[action.id];
        if (!handler) {
          return null;
        }
        return (
          <AutomationBuilderRow
            key={`${group}.action.${action.id}`}
            onDelete={() => {
              onDeleteRow(action.id);
              setActionHandlerMap(({[action.id]: _, ...rest}) => rest);
            }}
          >
            <ActionNodeContext.Provider
              value={{
                action,
                actionId: `${group}.action.${action.id}`,
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
        options={options}
        onChange={(obj: any) => {
          const actionId = uuid4();
          onAddRow(actionId, obj.value);
          setActionHandlerMap(currActionHandlerMap => ({
            ...currActionHandlerMap,
            [actionId]: obj.value,
          }));
        }}
        placeholder={placeholder}
        value={null}
      />
    </Fragment>
  );
}

function Node() {
  const {action} = useActionNodeContext();
  const node = actionNodesMap.get(action.type);

  const component = node?.action;
  return component ? component : node?.label;
}

const StyledSelectControl = styled(Select)`
  width: 100%;
`;
