import {Fragment, useEffect, useMemo} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  SidebarButton,
  SidebarItem,
  SidebarItemUnreadIndicator,
} from 'sentry/components/nav/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/components/nav/primary/primaryButtonOverlay';
import {BroadcastPanelItem} from 'sentry/components/sidebar/broadcastPanelItem';
import SidebarPanelEmpty from 'sentry/components/sidebar/sidebarPanelEmpty';
import {IconBroadcast} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Broadcast} from 'sentry/types/system';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

const MARK_SEEN_DELAY = 1000;

function makeBroadcastsQueryKey({
  organization,
}: {
  organization: Organization;
}): ApiQueryKey {
  return [`/organizations/${organization.slug}/broadcasts/`];
}

function useFetchBroadcasts() {
  const organization = useOrganization();

  return useApiQuery<Broadcast[]>(makeBroadcastsQueryKey({organization}), {
    // Five minute stale time prevents window focus frequent refetches
    staleTime: 1000 * 60 * 5,
    // 10 minutes poll
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });
}

function WhatsNewContent({unseenPostIds}: {unseenPostIds: string[]}) {
  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {mutate: markBroadcastsAsSeen} = useMutation({
    mutationFn: (newUnseenPostIds: string[]) => {
      return api.requestPromise('/broadcasts/', {
        method: 'PUT',
        query: {id: newUnseenPostIds},
        data: {hasSeen: '1'},
      });
    },
    onSuccess: () => {
      setApiQueryData<Broadcast[]>(
        queryClient,
        makeBroadcastsQueryKey({organization}),
        data => (data ? data.map(item => ({...item, hasSeen: true})) : [])
      );
    },
  });

  const {isPending, data: broadcasts = []} = useFetchBroadcasts();

  useEffect(() => {
    const markSeenTimeout = window.setTimeout(() => {
      markBroadcastsAsSeen(unseenPostIds);
    }, MARK_SEEN_DELAY);

    return () => {
      if (markSeenTimeout) {
        window.clearTimeout(markSeenTimeout);
      }
    };
  }, [unseenPostIds, markBroadcastsAsSeen]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (broadcasts.length === 0) {
    return (
      <SidebarPanelEmpty>
        {t('No recent updates from the Sentry team.')}
      </SidebarPanelEmpty>
    );
  }

  return (
    <Fragment>
      {broadcasts.map(item => (
        <BroadcastPanelItem
          key={item.id}
          hasSeen={item.hasSeen}
          title={item.title}
          message={item.message}
          link={item.link}
          mediaUrl={item.mediaUrl}
          category={item.category}
        />
      ))}
    </Fragment>
  );
}

export function PrimaryNavigationWhatsNew() {
  const {data: broadcasts = []} = useFetchBroadcasts();
  const unseenPostIds = useMemo(
    () => broadcasts.filter(item => !item.hasSeen).map(item => item.id),
    [broadcasts]
  );

  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = usePrimaryButtonOverlay();

  return (
    <SidebarItem>
      <SidebarButton
        analyticsKey="broadcasts"
        label={t("What's New")}
        buttonProps={overlayTriggerProps}
      >
        <IconBroadcast />
        {unseenPostIds.length > 0 && (
          <SidebarItemUnreadIndicator data-test-id="whats-new-unread-indicator" />
        )}
      </SidebarButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <WhatsNewContent unseenPostIds={unseenPostIds} />
        </PrimaryButtonOverlay>
      )}
    </SidebarItem>
  );
}
