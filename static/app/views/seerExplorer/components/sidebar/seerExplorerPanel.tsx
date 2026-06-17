import {SeerExplorerContent} from 'sentry/views/seerExplorer/components/sidebar/seerExplorerContent';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {usePageReferrer} from 'sentry/views/seerExplorer/utils';

/**
 * The Seer Explorer content as rendered inside the persistent split-panel
 * sidebar — wires the close action and dock-position controls to the Seer
 * context.
 */
export function SeerExplorerPanel() {
  const {getPageReferrer} = usePageReferrer();
  const {closeSeerExplorer, sidebarPosition, setSidebarPosition, sidebarInitialQuery} =
    useSeerExplorerContext();

  return (
    <SeerExplorerContent
      getPageReferrer={getPageReferrer}
      initialQuery={sidebarInitialQuery}
      onClose={closeSeerExplorer}
      sidebarPosition={sidebarPosition}
      onSidebarPositionChange={setSidebarPosition}
    />
  );
}
