import {createContext, useContext} from 'react';

import {t} from 'sentry/locale';
import type {Integration, NewAction} from 'sentry/types/workflowEngine/actions';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import DiscordNode from 'sentry/views/automations/components/actions/discord';
import MSTeamsNode from 'sentry/views/automations/components/actions/msTeams';

interface ActionNodeProps {
  action: NewAction;
  actionId: string;
  onUpdate: (condition: Record<string, any>) => void;
  integrations?: Integration[];
}

export const ActionNodeContext = createContext<ActionNodeProps | null>(null);

export function useActionNodeContext(): ActionNodeProps {
  const context = useContext(ActionNodeContext);
  if (!context) {
    throw new Error('useActionNodeContext was called outside of ActionNode');
  }
  return context;
}

type ActionNode = {
  action: React.ReactNode;
  label: string;
};

export const actionNodesMap = new Map<ActionType, ActionNode>([
  [
    ActionType.MSTEAMS,
    {
      label: t('MS Teams'),
      action: <MSTeamsNode />,
    },
  ],
  [
    ActionType.DISCORD,
    {
      label: t('Discord'),
      action: <DiscordNode />,
    },
  ],
]);
