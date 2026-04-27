import {useEffect} from 'react';

import {useDocumentTitleManager} from 'sentry/components/sentryDocumentTitle/documentTitleManager';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerExplorerUnreadCount} from 'sentry/views/seerExplorer/hooks/useSeerExplorerUnreadCount';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

const PREFIX_ID = 'seer-explorer-unread';

export function SeerExplorerUnreadTitle() {
  const organization = useOrganization({allowNull: true});
  const enabled = Boolean(
    organization?.features.includes('seer-explorer') && !organization?.hideAiFeatures
  );

  const {unreadCount, markAllRead, latestBlockTimestamp} =
    useSeerExplorerUnreadCount(enabled);
  const {isOpen} = useSeerExplorerContext();
  const {setPrefix, unregister} = useDocumentTitleManager();

  useEffect(() => {
    if (!enabled || !isOpen) {
      return;
    }
    markAllRead();
  }, [enabled, isOpen, markAllRead, latestBlockTimestamp]);

  useEffect(() => {
    setPrefix(PREFIX_ID, unreadCount > 0 ? `(${unreadCount}) ` : '');
  }, [setPrefix, unreadCount]);

  useEffect(() => {
    return () => unregister(PREFIX_ID);
  }, [unregister]);

  return null;
}
