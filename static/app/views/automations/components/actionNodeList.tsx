import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';
import type {Action, ActionType, Integration} from 'sentry/types/workflowEngine/actions';
import {
  ActionNodeContext,
  actionNodesMap,
  useActionNodeContext,
} from 'sentry/views/automations/components/actionNodes';
import AutomationBuilderRow from 'sentry/views/automations/components/automationBuilderRow';

interface ActionNodeListProps {
  actions: Action[];
  availableActions: Array<{type: ActionType; integrations?: Integration[]}>;
  group: string;
  onAddRow: (type: ActionType) => void;
  onDeleteRow: (id: string) => void;
  placeholder: string;
  updateAction: (id: string, data: Record<string, any>) => void;
}

export default function ActionNodeList({
  group,
  placeholder,
  actions,
  availableActions,
  onAddRow,
  onDeleteRow,
  updateAction,
}: ActionNodeListProps) {
  const options = Array.from(actionNodesMap)
    .filter(([value]) => availableActions.some(action => action.type === value))
    .map(([value, {label}]) => ({value, label}));

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
              integrations: availableActions.find(a => a.type === action.type)
                ?.integrations,
            }}
          >
            <Node />
          </ActionNodeContext.Provider>
        </AutomationBuilderRow>
      ))}
      <StyledSelectControl
        options={options}
        onChange={(obj: any) => {
          onAddRow(obj.value);
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
  return node?.action;
}

const StyledSelectControl = styled(Select)`
  width: 100%;
`;
