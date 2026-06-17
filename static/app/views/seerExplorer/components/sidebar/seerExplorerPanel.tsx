import {ExplorerDrawerContent} from 'sentry/views/seerExplorer/components/drawer/explorerDrawerContent';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {usePageReferrer} from 'sentry/views/seerExplorer/utils';

/**
 * The Seer Explorer content as rendered inside the persistent split-panel
 * sidebar. Reuses `ExplorerDrawerContent` with the `sidebar` surface, wiring the
 * close action and dock-position controls to the Seer context.
 */
export function SeerExplorerPanel() {
  const {getPageReferrer} = usePageReferrer();
  const {closeSeerExplorer, sidebarPosition, setSidebarPosition} =
    useSeerExplorerContext();

  return (
    <ExplorerDrawerContent
      getPageReferrer={getPageReferrer}
      surface="sidebar"
      onClose={closeSeerExplorer}
      sidebarPosition={sidebarPosition}
      onSidebarPositionChange={setSidebarPosition}
    />
  );
}
