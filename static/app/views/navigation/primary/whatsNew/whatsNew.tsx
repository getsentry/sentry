import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconBroadcast} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Broadcast} from 'sentry/types/system';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useNavigationContext} from 'sentry/views/navigation/context';
import {
  SidebarButton,
  SidebarItemUnreadIndicator,
} from 'sentry/views/navigation/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/views/navigation/primary/primaryButtonOverlay';
import {WhatsNewItem} from 'sentry/views/navigation/primary/whatsNew/item';
import {NavigationLayout} from 'sentry/views/navigation/types';

const MARK_SEEN_DELAY = 1000;
const MAX_VISIBLE_BROADCASTS = 3;

function makeBroadcastsQueryKey({
  organization,
}: {
  organization: Organization;
}): ApiQueryKey {
  return [
    getApiUrl(`/organizations/$organizationIdOrSlug/broadcasts/`, {
      path: {organizationIdOrSlug: organization.slug},
    }),
  ];
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

function WhatsNewContent() {
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

  const recentBroadcasts = broadcasts.slice(0, MAX_VISIBLE_BROADCASTS);

  const displayedUnseenIds = useMemo(
    () => recentBroadcasts.filter(item => !item.hasSeen).map(item => item.id),
    [recentBroadcasts]
  );

  useEffect(() => {
    if (displayedUnseenIds.length === 0) {
      return undefined;
    }
    const markSeenTimeout = window.setTimeout(() => {
      markBroadcastsAsSeen(displayedUnseenIds);
    }, MARK_SEEN_DELAY);

    return () => {
      window.clearTimeout(markSeenTimeout);
    };
  }, [displayedUnseenIds, markBroadcastsAsSeen]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (broadcasts.length === 0) {
    return <Empty>{t('No recent updates from the Sentry team.')}</Empty>;
  }

  return (
    <Fragment>
      {recentBroadcasts.map(item => (
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
      <ChangelogLink href="https://changelog.sentry.dev/">
        {t('View all changelog entries')} →
      </ChangelogLink>
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

  const {layout} = useNavigationContext();

  return (
    <Fragment>
      <SidebarButton
        analyticsKey="broadcasts"
        label={t("What's New")}
        buttonProps={{
          ...overlayTriggerProps,
          icon: <IconBroadcast />,
          size: 'sm',
        }}
      >
        {unseenPostIds.length > 0 && (
          <SidebarItemUnreadIndicator
            data-test-id="whats-new-unread-indicator"
            isMobile={layout === NavigationLayout.MOBILE}
          />
        )}
      </SidebarButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <WhatsNewContent />
        </PrimaryButtonOverlay>
      )}
    </Fragment>
  );
}

const ChangelogLink = styled(ExternalLink)`
  display: block;
  text-align: center;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space['2xl']};
  color: ${p => p.theme.tokens.content.accent};
  font-size: ${p => p.theme.font.size.md};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};

  &:hover {
    text-decoration: underline;
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
