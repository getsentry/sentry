import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconBroadcast} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Broadcast} from 'sentry/types/system';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useNavContext} from 'sentry/views/nav/context';
import {
  SidebarButton,
  SidebarItemUnreadIndicator,
} from 'sentry/views/nav/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/views/nav/primary/primaryButtonOverlay';
import {WhatsNewItem} from 'sentry/views/nav/primary/whatsNew/item';
import {NavLayout} from 'sentry/views/nav/types';

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
    return <Empty>{t('No recent updates from the Sentry team.')}</Empty>;
  }

  return (
    <Fragment>
      {broadcasts.map(item => (
        <WhatsNewItem
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

  const {layout} = useNavContext();

  return (
    <Fragment>
      <WhatsNewButton
        analyticsKey="broadcasts"
        label={t("What's New")}
        buttonProps={overlayTriggerProps}
      >
        <IconBroadcast />
        {unseenPostIds.length > 0 && (
          <SidebarItemUnreadIndicator
            data-test-id="whats-new-unread-indicator"
            isMobile={layout === NavLayout.MOBILE}
          />
        )}
      </WhatsNewButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <WhatsNewContent unseenPostIds={unseenPostIds} />
        </PrimaryButtonOverlay>
      )}
    </Fragment>
  );
}

const WhatsNewButton = styled(SidebarButton)`
  display: none;

  @media (min-height: 800px) {
    display: flex;
  }
`;

const Empty = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.tokens.content.secondary};
  padding: 0 60px;
  text-align: center;
  min-height: 150px;
`;
