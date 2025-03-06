import {createContext, useContext} from 'react';

import type {Crumb, CrumbDropdown} from 'sentry/components/breadcrumbs';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {useDocumentTitle} from 'sentry/components/sentryDocumentTitle';

export interface BreadcrumbsContextValue {
  crumbs: Array<Crumb | CrumbDropdown>;
}
export const BreadcrumbsContext = createContext<BreadcrumbsContextValue>({
  crumbs: [],
});

export function BreadcrumbsProvider({
  children,
  crumb,
}: {
  children: React.ReactNode;
  crumb: Crumb | CrumbDropdown;
}) {
  const context = useContext(BreadcrumbsContext);
  return (
    <BreadcrumbsContext.Provider value={{crumbs: [...context.crumbs, crumb]}}>
      {children}
    </BreadcrumbsContext.Provider>
  );
}

/**
 * Automatically render Breadcrumbs from the <BreadcrumbsProvider /> and <SentryDocumentTitle /> contexts
 */
export function BreadcrumbsFromContext() {
  const {crumbs = []} = useContext(BreadcrumbsContext);
  const documentTitle = useDocumentTitle();
  if (crumbs.length === 0) {
    throw new Error(
      `<BreadcrumbsFromContext> was not rendered inside of <BreadcrumbsProvider>!`
    );
  }
  const allCrumbs = [...crumbs];
  if (documentTitle) {
    allCrumbs.push({label: documentTitle});
  }
  return <Breadcrumbs crumbs={allCrumbs} />;
}
