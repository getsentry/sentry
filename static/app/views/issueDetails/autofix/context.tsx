import {createContext, useContext, type ReactNode} from 'react';

import {useSeerPanel} from 'sentry/components/events/autofix/v3/useSeerPanel';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

type AutofixPanelValue = ReturnType<typeof useSeerPanel>;

const AutofixPanelContext = createContext<AutofixPanelValue | null>(null);

/**
 * Runs Autofix once for the whole issue details column. The toolbar sits in the
 * issue navigation row and the analysis renders in the tab below it; the two are
 * siblings, so neither can own the state the other needs.
 *
 * Only mounted on the autofix tab — mounting it everywhere would start an
 * Autofix run for anyone who opens an issue.
 */
export function AutofixPanelProvider({
  children,
  group,
  project,
}: {
  children: ReactNode;
  group: Group;
  project: Project;
}) {
  const panel = useSeerPanel({group, project});
  return <AutofixPanelContext value={panel}>{children}</AutofixPanelContext>;
}

/**
 * Returns null outside the autofix tab, where no provider is mounted.
 */
export function useAutofixPanel() {
  return useContext(AutofixPanelContext);
}
