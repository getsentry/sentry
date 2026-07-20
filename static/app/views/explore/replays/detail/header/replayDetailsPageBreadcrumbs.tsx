import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Placeholder} from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {useLiveRefresh} from 'sentry/components/replays/replayLiveIndicator';
import {IconChevron, IconCopy, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {EventView} from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import type {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useReplayPlaylist} from 'sentry/utils/replays/playback/providers/replayPlaylistProvider';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';
import {TopBar} from 'sentry/views/navigation/topBar';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export function ReplayDetailsPageBreadcrumbs({readerResult}: Props) {
  const replayRecord = readerResult.replayRecord;
  const organization = useOrganization();
  const location = useLocation();
  const eventView = EventView.fromLocation(location);
  const project = useProjectFromId({
    project_id: replayRecord?.project_id ?? undefined,
  });
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

  const {copy} = useCopyToClipboard();

  if (organization.features.includes('ui-migration-breadcrumbs')) {
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
                  tooltip: nextReplay
                    ? t('Next replay based on search query')
                    : undefined,
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
                replayRecord
                  ? {
                      type: 'copy',
                      text: replayUrlWithTimestamp,
                      label: t('Copy link to replay at current timestamp'),
                      tooltip: t('Copy link to replay at current timestamp'),
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

  // Legacy breadcrumbs (flag off).
  return (
    <StyledBreadcrumbs
      crumbs={[
        {
          to: {
            pathname: makeReplaysPathname({
              path: '/',
              organization,
            }),
            query: {
              ...eventView.generateQueryStringObject(),
              project: replayRecord?.project_id,
            },
          },
          label: t('Session Replay'),
        },
        replayRecord
          ? {
              label: (
                <Flex align="center" gap="sm">
                  <div>
                    <Tooltip
                      title={t('Previous replay based on search query')}
                      disabled={!previousReplay}
                    >
                      <LinkButton
                        size="zero"
                        variant="transparent"
                        icon={<IconChevron direction="left" size="xs" />}
                        disabled={!previousReplay}
                        aria-label={t('Previous replay based on search query')}
                        to={{
                          pathname: previousReplay
                            ? makeReplaysPathname({
                                path: `/${previousReplay.id}/`,
                                organization,
                              })
                            : undefined,
                          query: initialLocation.current.query,
                        }}
                        onClick={() =>
                          trackAnalytics('replay.details-playlist-clicked', {
                            direction: 'previous',
                            organization,
                          })
                        }
                      />
                    </Tooltip>
                    <Tooltip
                      title={t('Next replay based on search query')}
                      disabled={!nextReplay}
                    >
                      <LinkButton
                        size="zero"
                        variant="transparent"
                        icon={<IconChevron direction="right" size="xs" />}
                        disabled={!nextReplay}
                        aria-label={t('Next replay based on search query')}
                        to={{
                          pathname: nextReplay
                            ? makeReplaysPathname({
                                path: `/${nextReplay.id}/`,
                                organization,
                              })
                            : undefined,
                          query: initialLocation.current.query,
                        }}
                        onClick={() =>
                          trackAnalytics('replay.details-playlist-clicked', {
                            direction: 'next',
                            organization,
                          })
                        }
                      />
                    </Tooltip>
                  </div>
                  <HoverArea align="center" gap="xs">
                    {project ? (
                      <ProjectBadge
                        disableLink
                        project={project}
                        avatarSize={16}
                        hideName
                      />
                    ) : (
                      <Placeholder width="16px" height="16px" />
                    )}
                    <div
                      onClick={() =>
                        copy(replayUrlWithTimestamp, {
                          successMessage: t('Copied replay link to clipboard'),
                        })
                      }
                    >
                      {getShortEventId(replayRecord?.id)}
                    </div>
                    <LinkCopyButton
                      tooltipProps={{
                        title: t('Copy link to replay at current timestamp'),
                      }}
                      aria-label={t('Copy link to replay at current timestamp')}
                      onClick={() =>
                        copy(replayUrlWithTimestamp, {
                          successMessage: t('Copied replay link to clipboard'),
                        })
                      }
                      size="zero"
                      variant="transparent"
                      icon={<IconCopy size="xs" variant="muted" />}
                    />
                  </HoverArea>
                  {shouldShowRefreshButton ? (
                    <Button
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
                  ) : null}
                </Flex>
              ),
            }
          : null,
      ].filter(defined)}
    />
  );
}

const StyledBreadcrumbs = styled(Breadcrumbs)`
  padding: 0;
  height: 34px;
`;

const HoverArea = styled(Flex)``;

const LinkCopyButton = styled(Button)`
  opacity: 0;

  ${HoverArea}:focus-within &,
  ${HoverArea}:hover & {
    opacity: 1;
  }
`;
