import {createContext, useContext, useRef} from 'react';

import type {Crumb, CrumbDropdown} from 'sentry/components/breadcrumbs';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {useDocumentTitle} from 'sentry/components/sentryDocumentTitle';

export interface BreadcrumbsContextValue {
  crumbs: React.RefObject<(Crumb | CrumbDropdown)[]>;
}
export const BreadcrumbsContext = createContext<BreadcrumbsContextValue>({
  crumbs: {current: []},
});

export function BreadcrumbsProvider({children}: {children: React.ReactNode}) {
  const crumbs = useRef<(Crumb | CrumbDropdown)[]>([]);
  return (
    <BreadcrumbsContext.Provider value={{crumbs}}>{children}</BreadcrumbsContext.Provider>
  );
}

export function BreadcrumbsFromContext() {
  const context = useContext(BreadcrumbsContext);
  const documentTitle = useDocumentTitle();
  if (!context.crumbs.current || context.crumbs.current.length === 0) {
    throw new Error(
      `<BreadcrumbsFromContext> was not rendered inside of <BreadcrumbsProvider>!`
    );
  }

  return <Breadcrumbs crumbs={[...context.crumbs.current, {label: documentTitle}]} />;
}
