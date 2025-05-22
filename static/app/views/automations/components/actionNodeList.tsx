import {Fragment, useMemo, useRef} from 'react';
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
  updateAction: (id: string, data: Record<string, any>) => void;
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
  const actionHandlerMapRef = useRef(new Map());

  const options = useMemo(() => {
    const typeOptionsMap = new Map<
      ActionGroup,
      Array<{label: string; value: ActionHandler}>
    >();

    availableActions.forEach(action => {
      const existingOptions = typeOptionsMap.get(action.handlerGroup) || [];
      const label =
        actionNodesMap.get(action.type)?.label || action.sentryApp?.name || action.type;

      typeOptionsMap.set(action.handlerGroup, [
        ...existingOptions,
        {
          value: action,
          label,
        },
      ]);
    });

    return [
      {
        key: ActionGroup.NOTIFICATION,
        label: t('Notifications'),
        options: typeOptionsMap.get(ActionGroup.NOTIFICATION) || [],
      },
      {
        key: ActionGroup.TICKET_CREATION,
        label: t('Ticket Creation'),
        options: typeOptionsMap.get(ActionGroup.TICKET_CREATION) || [],
      },
      {
        key: ActionGroup.OTHER,
        label: t('Other Integrations'),
        options: typeOptionsMap.get(ActionGroup.OTHER) || [],
      },
    ];
  }, [availableActions]);

  return (
    <Fragment>
      {actions.map(action => (
        <AutomationBuilderRow
          key={`${group}.action.${action.id}`}
          onDelete={() => {
            onDeleteRow(action.id);
          }}
        >
          <ActionNodeContext.Provider
            value={{
              action,
              actionId: `${group}.action.${action.id}`,
              onUpdate: newAction => updateAction(action.id, newAction),
              handler: actionHandlerMapRef.current.get(action.id),
            }}
          >
            <Node />
          </ActionNodeContext.Provider>
        </AutomationBuilderRow>
      ))}
      <StyledSelectControl
        options={options}
        onChange={(obj: any) => {
          const actionId = uuid4();
          onAddRow(actionId, obj.value);
          actionHandlerMapRef.current.set(actionId, obj.value);
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
