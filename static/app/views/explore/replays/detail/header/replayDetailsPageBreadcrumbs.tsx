import {Fragment, useMemo, useRef} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Button} from '@sentry/scraps/button';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Placeholder} from 'sentry/components/placeholder';
import {useLiveRefresh} from 'sentry/components/replays/replayLiveIndicator';
import {IconEllipsis, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {EventView} from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import type {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useReplayPlaylist} from 'sentry/utils/replays/playback/providers/replayPlaylistProvider';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {useReplayMenuItems} from 'sentry/views/explore/replays/detail/header/useReplayMenuItems';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';
import {TopBar} from 'sentry/views/navigation/topBar';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export function ReplayDetailsPageBreadcrumbs({readerResult}: Props) {
  const {replay, replayRecord, projectSlug} = readerResult;
  const organization = useOrganization();
  const location = useLocation();
  const eventView = EventView.fromLocation(location);
  const project = useProjectFromId({
    project_id: replayRecord?.project_id ?? undefined,
  });

  const {replays, currentReplayIndex} = useReplayPlaylist();
  const {shouldShowRefreshButton, doRefresh} = useLiveRefresh({
    replay: replayRecord ?? undefined,
  });

  const menuItems = useReplayMenuItems({
    projectSlug,
    isMobile: replay?.isVideoReplay() ?? false,
    replay: replay?.hasProcessingErrors() ? undefined : (replay ?? undefined),
    replayRecord: replayRecord ?? undefined,
  });

  const hasActionsMenu = !!replayRecord && !replayRecord.is_archived;

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

  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList
          items={[
            {
              type: 'link',
              label: t('Session Replay'),
              to: {
                pathname: makeReplaysPathname({path: '/', organization}),
                query: {
                  ...eventView.generateQueryStringObject(),
                  project: replayRecord?.project_id,
                },
              },
            },
          ]}
        />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        <BreadcrumbList.Title
          item={{
            type: 'page-title',
            label: replayRecord?.id
              ? getShortEventId(replayRecord.id)
              : t('Unknown Replay'),
            leadingGraphic: project ? (
              <ProjectBadge disableLink project={project} avatarSize={16} hideName />
            ) : (
              <Placeholder width="16px" height="16px" />
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
              hasActionsMenu
                ? {
                    type: 'menu',
                    triggerLabel: t('Replay Actions'),
                    triggerIcon: <IconEllipsis />,
                    items: menuItems,
                  }
                : null,
              shouldShowRefreshButton
                ? {
                    type: 'button',
                    element: (
                      <Button
                        tooltipProps={{
                          title: t('Replay is outdated. Refresh for latest activity.'),
                        }}
                        size="zero"
                        variant="primary"
                        onClick={doRefresh}
                        icon={<IconRefresh />}
                      >
                        {t('Update')}
                      </Button>
                    ),
                  }
                : null,
            ],
          }}
        />
      </TopBar.Slot>
    </Fragment>
  );
}
