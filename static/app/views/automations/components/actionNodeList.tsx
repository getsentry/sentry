import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';
import type {
  ActionType,
  Integration,
  NewAction,
} from 'sentry/types/workflowEngine/actions';
import {
  ActionNodeContext,
  actionNodesMap,
  useActionNodeContext,
} from 'sentry/views/automations/components/actionNodes';
import AutomationBuilderRow from 'sentry/views/automations/components/automationBuilderRow';

interface ActionNodeListProps {
  actions: NewAction[];
  availableActions: Array<{type: ActionType; integrations?: Integration[]}>;
  group: string;
  onAddRow: (type: ActionType) => void;
  onDeleteRow: (id: number) => void;
  placeholder: string;
  updateAction: (index: number, data: Record<string, any>) => void;
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
  const options = Array.from(actionNodesMap.entries())
    .map(([value, {label}]) => ({
      value,
      label,
    }))
    .filter(({value}) => availableActions.some(action => action.type === value));

  return (
    <Fragment>
      {actions.map((action, i) => (
        <AutomationBuilderRow
          key={`${group}.action.${i}`}
          onDelete={() => {
            onDeleteRow(i);
          }}
        >
          <ActionNodeContext.Provider
            value={{
              action,
              actionId: `${group}.action.${i}`,
              onUpdate: newAction => updateAction(i, newAction),
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
