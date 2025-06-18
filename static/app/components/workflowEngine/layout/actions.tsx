import {createContext, useContext} from 'react';

import {Flex} from 'sentry/components/core/layout';
import {HeaderActions} from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';

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
      <Flex gap={space(1)}>{actions}</Flex>
    </HeaderActions>
  );
}
