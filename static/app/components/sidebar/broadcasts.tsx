import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {markBroadcastsAsSeen} from 'sentry/actionCreators/broadcasts';
import DemoModeGate from 'sentry/components/acl/demoModeGate';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {BroadcastPanelItem} from 'sentry/components/sidebar/broadcastPanelItem';
import SidebarItem from 'sentry/components/sidebar/sidebarItem';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import SidebarPanelEmpty from 'sentry/components/sidebar/sidebarPanelEmpty';
import {IconBroadcast} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Broadcast} from 'sentry/types/system';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';

import type {CommonSidebarProps} from './types';
import {SidebarPanelKey} from './types';

const MARK_SEEN_DELAY = 1000;
const POLLER_DELAY = 600000; // 10 minute poll (60 * 10 * 1000)

export function Broadcasts({
  orientation,
  collapsed,
  currentPanel,
  hidePanel,
  onShowPanel,
}: CommonSidebarProps) {
  const api = useApi();
  const organization = useOrganization();
  const previousPanel = usePrevious(currentPanel);

  const [hasSeenAllPosts, setHasSeenAllPosts] = useState(false);
  const markSeenTimeoutRef = useRef<number | undefined>(undefined);

  const {isPending, data: broadcasts = []} = useApiQuery<Broadcast[]>(
    [`/organizations/${organization.slug}/broadcasts/`],
    {
      staleTime: 0,
      refetchInterval: POLLER_DELAY,
      refetchOnWindowFocus: true,
    }
  );

  const unseenPostIds = useMemo(
    () => broadcasts.filter(item => !item.hasSeen).map(item => item.id),
    [broadcasts]
  );

  const markSeen = useCallback(async () => {
    if (unseenPostIds.length === 0) {
      return;
    }

    await markBroadcastsAsSeen(api, unseenPostIds);
  }, [api, unseenPostIds]);

  const handleShowPanel = useCallback(() => {
    if (markSeenTimeoutRef.current) {
      window.clearTimeout(markSeenTimeoutRef.current);
    }

    markSeenTimeoutRef.current = window.setTimeout(() => {
      markSeen();
    }, MARK_SEEN_DELAY);

    onShowPanel();
  }, [onShowPanel, markSeen]);

  useEffect(() => {
    if (
      previousPanel === SidebarPanelKey.BROADCASTS &&
      currentPanel !== SidebarPanelKey.BROADCASTS
    ) {
      setHasSeenAllPosts(true);
    }
  }, [previousPanel, currentPanel]);

  useEffect(() => {
    return () => {
      if (markSeenTimeoutRef.current) {
        window.clearTimeout(markSeenTimeoutRef.current);
      }
    };
  }, []);

  return (
    <DemoModeGate>
      <SidebarItem
        data-test-id="sidebar-broadcasts"
        orientation={orientation}
        collapsed={collapsed}
        active={currentPanel === SidebarPanelKey.BROADCASTS}
        badge={hasSeenAllPosts ? undefined : unseenPostIds?.length}
        icon={<IconBroadcast size="md" />}
        label={t("What's new")}
        onClick={handleShowPanel}
        id="broadcasts"
      />

      {currentPanel === SidebarPanelKey.BROADCASTS && (
        <SidebarPanel
          data-test-id="sidebar-broadcasts-panel"
          orientation={orientation}
          collapsed={collapsed}
          title={t("What's new in Sentry")}
          hidePanel={hidePanel}
        >
          {isPending ? (
            <LoadingIndicator />
          ) : broadcasts.length === 0 ? (
            <SidebarPanelEmpty>
              {t('No recent updates from the Sentry team.')}
            </SidebarPanelEmpty>
          ) : (
            broadcasts.map(item => (
              <BroadcastPanelItem
                key={item.id}
                hasSeen={item.hasSeen}
                title={item.title}
                message={item.message}
                link={item.link}
                mediaUrl={item.mediaUrl}
                category={item.category}
              />
            ))
          )}
        </SidebarPanel>
      )}
    </DemoModeGate>
  );
}
