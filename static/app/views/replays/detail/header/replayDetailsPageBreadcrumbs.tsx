import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {useLiveRefresh} from 'sentry/components/replays/replayLiveIndicator';
import {IconChevron, IconCopy, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useReplayPlaylist} from 'sentry/utils/replays/playback/providers/replayPlaylistProvider';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export default function ReplayDetailsPageBreadcrumbs({readerResult}: Props) {
  const replayRecord = readerResult.replayRecord;
  const organization = useOrganization();
  const location = useLocation();
  const eventView = EventView.fromLocation(location);
  const project = useProjectFromId({project_id: replayRecord?.project_id ?? undefined});
  const [isHovered, setIsHovered] = useState(false);
  const {currentTime} = useReplayContext();

  const {replays, currentReplayIndex} = useReplayPlaylist();
  const {shouldShowRefreshButton, doRefresh} = useLiveRefresh({
    replay: replayRecord ?? undefined,
  });

  // We use a ref to store the initial location so that we can use it to navigate to the previous and next replays
  // without dirtying the URL with the URL params from the tabs navigation.
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
  // Create URL with current timestamp for copying
  const replayUrlWithTimestamp = replayRecord
    ? (() => {
        const url = new URL(window.location.href);
        const currentTimeInSeconds = Math.floor(currentTime / 1000);
        url.searchParams.set('t', String(currentTimeInSeconds));
        return url.toString();
      })()
    : '';

  const {copy} = useCopyToClipboard();

  const listPageCrumb = {
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
  };

  const replayCrumb = {
    label: replayRecord ? (
      <Flex>
        <Flex align="center" gap="sm">
          {organization.features.includes('replay-playlist-view') && (
            <div>
              <LinkButton
                size="zero"
                borderless
                icon={<IconChevron direction="left" size="xs" />}
                disabled={!previousReplay}
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
              <LinkButton
                size="zero"
                borderless
                icon={<IconChevron direction="right" size="xs" />}
                disabled={!nextReplay}
                to={{
                  pathname: nextReplay
                    ? makeReplaysPathname({path: `/${nextReplay.id}/`, organization})
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
            </div>
          )}
          <Flex
            align="center"
            gap="xs"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {project ? (
              <ProjectBadge disableLink project={project} avatarSize={16} hideName />
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
            {isHovered && (
              <Button
                title={t('Copy link to replay at current timestamp')}
                aria-label={t('Copy link to replay at current timestamp')}
                onClick={() =>
                  copy(replayUrlWithTimestamp, {
                    successMessage: t('Copied replay link to clipboard'),
                  })
                }
                size="zero"
                borderless
                icon={<IconCopy size="xs" variant="muted" />}
              />
            )}
          </Flex>
          {shouldShowRefreshButton ? (
            <Button
              title={t('Replay is outdated. Refresh for latest activity.')}
              data-test-id="refresh-button"
              size="zero"
              priority="link"
              onClick={doRefresh}
              icon={<IconRefresh size="xs" variant="accent" />}
            >
              <Text size="md" variant="accent">
                {t('Update')}
              </Text>
            </Button>
          ) : null}
        </Flex>
      </Flex>
    ) : (
      <Placeholder width="100%" height="16px" />
    ),
  };

  const crumbs = [listPageCrumb, replayRecord ? replayCrumb : null].filter(defined);

  return <StyledBreadcrumbs crumbs={crumbs} />;
}

const StyledBreadcrumbs = styled(Breadcrumbs)`
  padding: 0;
  height: 34px;
`;
