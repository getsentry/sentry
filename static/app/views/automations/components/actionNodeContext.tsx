import {createContext, useContext} from 'react';

import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';

interface ActionNodeProps {
  action: Action;
  actionId: string;
  handler: ActionHandler;
  onUpdate: (params: Record<string, any>) => void;
}

export const ActionNodeContext = createContext<ActionNodeProps | null>(null);

export function useActionNodeContext(): ActionNodeProps {
  const context = useContext(ActionNodeContext);
  if (!context) {
    throw new Error('useActionNodeContext was called outside of ActionNode');
  }
  return context;
}
