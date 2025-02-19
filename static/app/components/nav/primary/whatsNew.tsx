import {Fragment, useEffect, useMemo, useRef} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useNavContext} from 'sentry/components/nav/context';
import {
  NavButton,
  SidebarItem,
  SidebarItemBadge,
} from 'sentry/components/nav/primary/components';
import {NavLayout} from 'sentry/components/nav/types';
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

export function WhatsNew() {
  const ref = useRef<HTMLButtonElement>(null);
  const {openDrawer, isDrawerOpen, closeDrawer} = useDrawer();
  const {data: broadcasts = []} = useFetchBroadcasts();
  const unseenPostIds = useMemo(
    () => broadcasts.filter(item => !item.hasSeen).map(item => item.id),
    [broadcasts]
  );

  const {layout} = useNavContext();
  const showLabel = layout === NavLayout.MOBILE;

  return (
    <SidebarItem>
      <NavButton
        ref={ref}
        onClick={() => {
          if (isDrawerOpen) {
            closeDrawer();
          } else {
            openDrawer(() => <WhatsNewContent unseenPostIds={unseenPostIds} />, {
              ariaLabel: t("What's New"),
              shouldCloseOnInteractOutside: el => !ref.current?.contains(el),
            });
          }
        }}
        aria-label={showLabel ? undefined : t("What's New")}
        isMobile={layout === NavLayout.MOBILE}
      >
        <InteractionStateLayer />
        <IconBroadcast />
        {showLabel && <span>{t("What's New")}</span>}
        {unseenPostIds.length > 0 && (
          <SidebarItemBadge data-test-id="whats-new-badge">
            {unseenPostIds.length}
          </SidebarItemBadge>
        )}
      </NavButton>
    </SidebarItem>
  );
}
