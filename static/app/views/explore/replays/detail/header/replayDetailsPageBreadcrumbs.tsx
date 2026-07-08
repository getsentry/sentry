import {useMemo, useRef} from 'react';

import {Button} from '@sentry/scraps/button';
import {LeadingGraphic} from '@sentry/scraps/leadingGraphic';
import {Text} from '@sentry/scraps/text';

import type {BreadcrumbItem} from 'sentry/components/breadcrumbList';
import {BreadcrumbList} from 'sentry/components/breadcrumbList';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Placeholder} from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {useLiveRefresh} from 'sentry/components/replays/replayLiveIndicator';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {EventView} from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import type {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useReplayPlaylist} from 'sentry/utils/replays/playback/providers/replayPlaylistProvider';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export function ReplayDetailsPageBreadcrumbs({readerResult}: Props) {
  const replayRecord = readerResult.replayRecord;
  const organization = useOrganization();
  const location = useLocation();
  const eventView = EventView.fromLocation(location);
  const project = useProjectFromId({project_id: replayRecord?.project_id ?? undefined});
  const {currentTime} = useReplayContext();

  const {replays, currentReplayIndex} = useReplayPlaylist();
  const {shouldShowRefreshButton, doRefresh} = useLiveRefresh({
    replay: replayRecord ?? undefined,
  });

  // We use a ref to store the initial location so that we can navigate to the
  // previous and next replays without dirtying the URL with the tab-navigation params.
  const initialLocation = useRef(location);

  const nextReplay = useMemo(
    () =>
      currentReplayIndex >= 0 && currentReplayIndex < (replays?.length ?? 0) - 1
        ? replays?.[currentReplayIndex + 1]
        : undefined,
    [replays, currentReplayIndex]
  );
  const previousReplay = useMemo(
    () => (currentReplayIndex > 0 ? replays?.[currentReplayIndex - 1] : undefined),
    [replays, currentReplayIndex]
  );

  // URL with the current timestamp, for the copy action.
  const replayUrlWithTimestamp = replayRecord
    ? (() => {
        const url = new URL(window.location.href);
        const currentTimeInSeconds = Math.floor(currentTime / 1000);
        url.searchParams.set('t', String(currentTimeInSeconds));
        return url.toString();
      })()
    : '';

  const items: BreadcrumbItem[] = [
    {
      type: 'link',
      props: {
        label: t('Session Replay'),
        to: {
          pathname: makeReplaysPathname({path: '/', organization}),
          query: {
            ...eventView.generateQueryStringObject(),
            project: replayRecord?.project_id,
          },
        },
      },
    },
  ];

  if (replayRecord) {
    items.push({
      type: 'page-title',
      props: {
        label: getShortEventId(replayRecord.id),
        leadingGraphic: (
          <LeadingGraphic
            variant="avatar"
            avatar={
              project ? (
                <ProjectBadge disableLink project={project} avatarSize={16} hideName />
              ) : (
                <Placeholder width="16px" height="16px" />
              )
            }
          />
        ),
        pagination: {
          previous: {
            ariaLabel: t('Previous replay based on search query'),
            tooltip: previousReplay
              ? t('Previous replay based on search query')
              : undefined,
            to: previousReplay
              ? {
                  pathname: makeReplaysPathname({
                    path: `/${previousReplay.id}/`,
                    organization,
                  }),
                  query: initialLocation.current.query,
                }
              : undefined,
            onClick: () =>
              trackAnalytics('replay.details-playlist-clicked', {
                direction: 'previous',
                organization,
              }),
          },
          next: {
            ariaLabel: t('Next replay based on search query'),
            tooltip: nextReplay ? t('Next replay based on search query') : undefined,
            to: nextReplay
              ? {
                  pathname: makeReplaysPathname({
                    path: `/${nextReplay.id}/`,
                    organization,
                  }),
                  query: initialLocation.current.query,
                }
              : undefined,
            onClick: () =>
              trackAnalytics('replay.details-playlist-clicked', {
                direction: 'next',
                organization,
              }),
          },
        },
        trailingActions: [
          <BreadcrumbList.CopyAction
            key="copy"
            text={replayUrlWithTimestamp}
            label={t('Copy link to replay at current timestamp')}
            tooltip={t('Copy link to replay at current timestamp')}
          />,
          shouldShowRefreshButton ? (
            <Button
              key="refresh"
              tooltipProps={{
                title: t('Replay is outdated. Refresh for latest activity.'),
              }}
              data-test-id="refresh-button"
              size="zero"
              variant="link"
              onClick={doRefresh}
              icon={<IconRefresh size="xs" variant="accent" />}
            >
              <Text size="md" variant="accent">
                {t('Update')}
              </Text>
            </Button>
          ) : null,
        ],
      },
    });
  }

  return <BreadcrumbList items={items} />;
}
