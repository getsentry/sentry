import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconBroadcast} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Broadcast} from 'sentry/types/system';
import {trackAnalytics} from 'sentry/utils/analytics';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';
import {
  PrimaryButtonOverlay,
  SidebarButton,
  SidebarItemUnreadIndicator,
  usePrimaryButtonOverlay,
} from 'sentry/views/navigation/primary/components';
import {NavigationLayout} from 'sentry/views/navigation/types';

export const BROADCAST_CATEGORIES: Record<NonNullable<Broadcast['category']>, string> = {
  announcement: t('Announcement'),
  feature: t('New Feature'),
  blog: t('Blog Post'),
  event: t('Event'),
  video: t('Video'),
};

function WhatsNewContent({
  unseenPostIds,
  isPending,
  broadcasts = [],
}: {
  broadcasts: Broadcast[] | undefined;
  isPending: boolean;
  unseenPostIds: string[];
}) {
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
        [
          getApiUrl(`/organizations/$organizationIdOrSlug/broadcasts/`, {
            path: {organizationIdOrSlug: organization.slug},
          }),
          {query: {show: 'latest', limit: '3'}},
        ],
        data => (data ? data.map(item => ({...item, hasSeen: true})) : [])
      );
    },
  });

  useEffect(() => {
    if (unseenPostIds.length === 0) {
      return undefined;
    }
    const MARK_SEEN_DELAY = 1000;
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
      <Flex padding="xl" justify="center" align="center" minHeight="150px">
        <Text variant="muted">{t('No recent updates from the Sentry team.')}</Text>
      </Flex>
    );
  }

  return (
    <Fragment>
      {broadcasts.map(item => {
        return (
          <SidebarPanelItemRoot key={item.id}>
            <Stack align="start" marginBottom="lg">
              {item.category && (
                <CategoryTag variant="muted">
                  {BROADCAST_CATEGORIES[item.category]}
                </CategoryTag>
              )}
              <Title
                hasSeen={item.hasSeen}
                href={item.link}
                onClick={() =>
                  trackAnalytics('whats_new.link_clicked', {
                    organization,
                    title: item.title,
                    category: item.category,
                  })
                }
              >
                {item.title}
              </Title>
              <Message>{item.message}</Message>
            </Stack>
            {item.mediaUrl && <Media src={item.mediaUrl} alt={item.title} />}
          </SidebarPanelItemRoot>
        );
      })}
    </Fragment>
  );
}

export function PrimaryNavigationWhatsNew() {
  const organization = useOrganization();
  const {isPending, data: broadcasts} = useApiQuery<Broadcast[]>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/broadcasts/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {show: 'latest', limit: '3'}},
    ],
    {
      // Five minute stale time prevents window focus frequent refetches
      staleTime: 1000 * 60 * 5,
      // 10 minutes poll
      refetchInterval: 1000 * 60 * 10,
      refetchOnWindowFocus: true,
    }
  );
  const unseenPostIds = useMemo(
    () => (broadcasts ?? []).filter(item => !item.hasSeen).map(item => item.id),
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
          <WhatsNewContent
            unseenPostIds={unseenPostIds}
            isPending={isPending}
            broadcasts={broadcasts}
          />
        </PrimaryButtonOverlay>
      )}
    </Fragment>
  );
}

const SidebarPanelItemRoot = styled('div')`
  line-height: 1.5;
  margin: 0 ${p => p.theme.space['2xl']};
  padding: ${p => p.theme.space.xl} 0;

  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const Title = styled(ExternalLink)<{hasSeen: boolean}>`
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
