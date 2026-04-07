import {Fragment, useEffect, useMemo} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Image} from '@sentry/scraps/image';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {IconBroadcast} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Broadcast} from 'sentry/types/system';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  PrimaryNavigation,
  usePrimaryNavigationButtonOverlay,
} from 'sentry/views/navigation/primary/components';

const BROADCAST_CATEGORIES: Record<NonNullable<Broadcast['category']>, string> = {
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
        data => (Array.isArray(data) ? data.map(item => ({...item, hasSeen: true})) : [])
      );
    },
  });

  useEffect(() => {
    if (unseenPostIds.length === 0) {
      return undefined;
    }

    const MARK_SEEN_DELAY = 2000;
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
    return (
      <Stack overscrollBehavior="contain" gap="xl">
        {[1, 2, 3].map(item => (
          <Stack key={item} gap="md">
            <Flex align="center" justify="between" flex={1}>
              <Placeholder height="24px" width="64%" />
              <Placeholder height="24px" width="30%" />
            </Flex>
            <Placeholder height="124px" width="100%" />

            {item < 3 && <Stack.Separator border="muted" />}
          </Stack>
        ))}
      </Stack>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <Flex justify="center" align="center" overscrollBehavior="contain">
        <Text variant="muted">{t('No recent updates from the Sentry team.')}</Text>
      </Flex>
    );
  }

  return (
    <Stack overscrollBehavior="contain" gap="xl" as="ul" padding="0">
      {broadcasts.map((item, idx) => {
        return (
          <Stack key={item.id} as="li">
            <Stack align="start" gap="md">
              <Flex align="center" justify="between" width="100%" gap="md">
                <Flex flex="0 1 auto" minWidth="0">
                  {p => (
                    <ExternalLink
                      {...p}
                      href={item.link}
                      onClick={() =>
                        trackAnalytics('whats_new.link_clicked', {
                          organization,
                          title: item.title,
                          category: item.category,
                        })
                      }
                    >
                      <Text ellipsis bold size="md">
                        {item.title}
                      </Text>
                    </ExternalLink>
                  )}
                </Flex>
                {item.category ? (
                  <Tag variant={item.category === 'feature' ? 'info' : 'muted'}>
                    {BROADCAST_CATEGORIES[item.category]}
                  </Tag>
                ) : null}
              </Flex>
              <Text>{item.message}</Text>
              {item.mediaUrl ? (
                <Image width="100%" src={item.mediaUrl} alt={item.title} radius="md" />
              ) : null}
              {idx < broadcasts.length - 1 && <Stack.Separator />}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
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
    () =>
      (Array.isArray(broadcasts) ? broadcasts : [])
        .filter(item => !item.hasSeen)
        .map(item => item.id),
    [broadcasts]
  );

  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = usePrimaryNavigationButtonOverlay();

  return (
    <Fragment>
      <PrimaryNavigation.Button
        analyticsKey="broadcasts"
        label={t("What's New")}
        indicator={unseenPostIds.length > 0 ? 'accent' : undefined}
        buttonProps={{
          ...overlayTriggerProps,
          icon: <IconBroadcast />,
        }}
      />
      {isOpen && (
        <PrimaryNavigation.ButtonOverlay overlayProps={overlayProps}>
          <WhatsNewContent
            unseenPostIds={unseenPostIds}
            isPending={isPending}
            broadcasts={Array.isArray(broadcasts) ? broadcasts : []}
          />
        </PrimaryNavigation.ButtonOverlay>
      )}
    </Fragment>
  );
}
