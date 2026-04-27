import {useEffect} from 'react';

import {useDocumentTitleManager} from 'sentry/components/sentryDocumentTitle/documentTitleManager';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

const PREFIX_ID = 'seer-explorer-unread';

export function SeerExplorerUnreadTitle() {
  const {unreadCount} = useSeerExplorerContext();
  const {setPrefix, unregister} = useDocumentTitleManager();

  useEffect(() => {
    setPrefix(PREFIX_ID, unreadCount > 0 ? `(${unreadCount}) ` : '');
  }, [setPrefix, unreadCount]);

  useEffect(() => {
    return () => unregister(PREFIX_ID);
  }, [unregister]);

  return null;
}
