import {createContext, useContext} from 'react';

import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {HeaderActions} from 'sentry/components/layouts/thirds';

const ActionContext = createContext<React.ReactNode | undefined>(undefined);

export function ActionsProvider({
  children,
  actions,
}: {
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  return <ActionContext value={actions}>{children}</ActionContext>;
}

/**
 * Automatically displays action buttons in the page header
 * if populated through ActionContext
 */
export function ActionsFromContext() {
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
