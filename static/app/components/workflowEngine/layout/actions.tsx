import {createContext, useContext} from 'react';

import ButtonBar from 'sentry/components/buttonBar';
import {HeaderActions} from 'sentry/components/layouts/thirds';

const ActionContext = createContext<React.ReactNode | undefined>(undefined);

export function WorkflowEngineActionProvider({
  children,
  actions,
}: {
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  return <ActionContext.Provider value={actions}>{children}</ActionContext.Provider>;
}

/**
 * Automatically displays action buttons in the page header
 * if populated through ActionContext
 */
export function WorkflowEngineActions() {
  const actions = useContext(ActionContext);
  if (!actions) {
    return null;
  }
  return (
    <HeaderActions>
      <ButtonBar merged={false} gap={1}>
        {actions}
      </ButtonBar>
    </HeaderActions>
  );
}
