import {SeerExplorerContent} from 'sentry/views/seerExplorer/components/seerExplorerContent';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {usePageReferrer} from 'sentry/views/seerExplorer/utils';

/**
 * The Seer Explorer content as rendered inside the persistent split-panel
 * sidebar — wires the close action and dock-position controls to the Seer
 * context.
 */
export function SeerExplorerPanel() {
  const {getPageReferrer} = usePageReferrer();
  const {
    closeSeerExplorer,
    sidebarPosition,
    setSidebarPosition,
    sidebarInitialQuery,
    sidebarKey,
  } = useSeerExplorerContext();

  return (
    // Remount on each forwarded query so a re-forwarded query auto-submits again
    // (the content's submit guard resets on mount), mirroring how the drawer
    // remounts per open.
    <SeerExplorerContent
      key={sidebarKey}
      getPageReferrer={getPageReferrer}
      initialQuery={sidebarInitialQuery}
      onClose={closeSeerExplorer}
      sidebarPosition={sidebarPosition}
      onSidebarPositionChange={setSidebarPosition}
    />
  );
}
