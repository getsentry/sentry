import {useEffect} from 'react';

import {useDocumentTitleManager} from 'sentry/components/sentryDocumentTitle/documentTitleManager';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

const PREFIX_ID = 'seer-explorer-unread';

/**
 * Prepends an unread msg count to the document title when the drawer is closed.
 */
export function useSeerExplorerDocumentTitle() {
  const organization = useOrganization({allowNull: true});
  const {unreadCount} = useSeerExplorerContext();
  const {setPrefix} = useDocumentTitleManager();
  const enabled = isSeerExplorerEnabled(organization);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    setPrefix(PREFIX_ID, unreadCount > 0 ? `(${unreadCount}) ` : '');
    return () => setPrefix(PREFIX_ID, '');
  }, [enabled, setPrefix, unreadCount]);
}
