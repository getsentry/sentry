import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconBroadcast} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Broadcast} from 'sentry/types/system';
import {trackAnalytics} from 'sentry/utils/analytics';
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
import {PrimaryNavigation} from 'sentry/views/navigation/components/primary';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';
import {NavigationLayout} from 'sentry/views/navigation/types';

const MARK_SEEN_DELAY = 1000;

export const BROADCAST_CATEGORIES: Record<NonNullable<Broadcast['category']>, string> = {
  announcement: t('Announcement'),
  feature: t('New Feature'),
  blog: t('Blog Post'),
  event: t('Event'),
  video: t('Video'),
};

interface BroadcastPanelItemProps extends Pick<
  Broadcast,
  'hasSeen' | 'category' | 'title' | 'message' | 'link' | 'mediaUrl'
> {}

function WhatsNewItem({
  hasSeen,
  title,
  message,
  link,
  mediaUrl,
  category,
}: BroadcastPanelItemProps) {
  const organization = useOrganization();

  const handlePanelClicked = useCallback(() => {
    trackAnalytics('whats_new.link_clicked', {organization, title, category});
  }, [organization, title, category]);

  return (
    <SidebarPanelItemRoot>
      <Stack align="start" marginBottom="lg">
        {category && (
          <CategoryTag variant="muted">{BROADCAST_CATEGORIES[category]}</CategoryTag>
        )}
        <Title hasSeen={hasSeen} href={link} onClick={handlePanelClicked}>
          {title}
        </Title>
        <Message>{message}</Message>
      </Stack>
      {mediaUrl && <Media src={mediaUrl} alt={title} />}
    </SidebarPanelItemRoot>
  );
}

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
  } = PrimaryNavigation.useButtonOverlay();

  const {layout} = useNavigationContext();

  return (
    <Fragment>
      <PrimaryNavigation.Button
        analyticsKey="broadcasts"
        label={t("What's New")}
        buttonProps={{
          ...overlayTriggerProps,
          icon: <IconBroadcast />,
          size: 'sm',
        }}
      >
        {unseenPostIds.length > 0 && (
          <PrimaryNavigation.ButtonUnreadIndicator
            data-test-id="whats-new-unread-indicator"
            isMobile={layout === NavigationLayout.MOBILE}
          />
        )}
      </PrimaryNavigation.Button>
      {isOpen && (
        <PrimaryNavigation.ButtonOverlay overlayProps={overlayProps}>
          <WhatsNewContent unseenPostIds={unseenPostIds} />
        </PrimaryNavigation.ButtonOverlay>
      )}
    </Fragment>
  );
}

const Empty = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.tokens.content.secondary};
  padding: 0 60px;
  text-align: center;
  min-height: 150px;
`;

const SidebarPanelItemRoot = styled('div')`
  line-height: 1.5;
  margin: 0 ${p => p.theme.space['2xl']};
  padding: ${p => p.theme.space.xl} 0;

  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const Title = styled(ExternalLink)<Pick<BroadcastPanelItemProps, 'hasSeen'>>`
  font-size: ${p => p.theme.font.size.lg};
  color: ${p => p.theme.tokens.content.accent};
  ${p => !p.hasSeen && `font-weight: ${p.theme.font.weight.sans.medium}`};
  &:focus-visible {
    box-shadow: none;
  }
`;

const Message = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const Media = styled('img')`
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.colors.gray200};
  max-width: 100%;
`;

const CategoryTag = styled(Tag)`
  margin-bottom: ${p => p.theme.space.md};
`;
