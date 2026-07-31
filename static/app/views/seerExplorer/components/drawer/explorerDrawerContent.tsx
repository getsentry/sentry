import {DrawerHeader, useDrawerContentContext} from '@sentry/scraps/drawer';

import {SeerExplorerContent} from 'sentry/views/seerExplorer/components/seerExplorerContent';

/**
 * Drawer surface for Seer Explorer: renders the shared content with the drawer's
 * header chrome. The close affordance comes from `DrawerHeader`, and its handler
 * from the drawer context.
 *
 * This is the only Seer file coupled to the scraps drawer — when the
 * persistent-sidebar flag is removed, deleting it (and `useSeerExplorerDrawer`)
 * drops the drawer surface entirely; the shared content has no drawer imports.
 */
export function ExplorerDrawerContent({
  getPageReferrer,
  initialQuery,
}: {
  getPageReferrer: () => string;
  initialQuery?: string;
}) {
  const {onClose = () => {}} = useDrawerContentContext();

  return (
    <SeerExplorerContent
      getPageReferrer={getPageReferrer}
      initialQuery={initialQuery}
      onClose={onClose}
      renderHeader={({children, isPoppedOut}) => (
        <DrawerHeader hideBar hideCloseButtonText hideCloseButton={isPoppedOut}>
          {children}
        </DrawerHeader>
      )}
    />
  );
}
