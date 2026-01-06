import invariant from 'invariant';

import {Flex} from '@sentry/scraps/layout';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Grid} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {DateTime} from 'sentry/components/dateTime';
import Placeholder from 'sentry/components/placeholder';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import {LiveBadge, useLiveBadge} from 'sentry/components/replays/replayLiveIndicator';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons/iconCalendar';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import useOrganization from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
import type {ReplayRecord} from 'sentry/views/replays/types';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}
export default function ReplayDetailsUserBadge({readerResult}: Props) {
  const replayRecord = readerResult.replayRecord;

  const badge = replayRecord ? (
    <Flex gap="md" align="center">
      <ReplayBadge replay={replayRecord} />
    </Flex>
  ) : null;

  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => null}
      renderError={() => null}
      renderThrottled={() => null}
      renderLoading={() =>
        replayRecord ? badge : <Placeholder width="251px" height="42px" />
      }
      renderMissing={() => null}
      renderProcessingError={() => badge}
    >
      {() => badge}
    </ReplayLoadingState>
  );
}

/**
 * Modified <ReplayBadge /> that is only used in header of Replay Details
 */
function ReplayBadge({replay}: {replay: ReplayRecord}) {
  const organization = useOrganization();
  const [prefs] = useReplayPrefs();
  const timestampType = prefs.timestampType;

  const {isLive} = useLiveBadge({
    startedAt: replay.started_at,
    finishedAt: replay.finished_at,
  });

  if (replay.is_archived) {
    return (
      <Grid columns="24px 1fr" gap="md" align="center" justify="center">
        <Flex align="center" justify="center">
          <IconDelete variant="muted" size="md" />
        </Flex>

        <Flex direction="column" gap="xs" justify="center">
          <Text size="md" bold>
            {t('Deleted Replay')}
          </Text>
        </Flex>
      </Grid>
    );
  }

  invariant(
    replay.started_at,
    'For TypeScript: replay.started_at is implied because replay.is_archived is false'
  );

  // Generate search query based on available user data
  const searchQuery = getUserSearchQuery({user: replay.user});

  const replaysIndexUrl = searchQuery
    ? {
        pathname: makeReplaysPathname({
          path: '/',
          organization,
        }),
        query: {
          query: searchQuery,
        },
      }
    : null;

  const replaysIndexLinkText = (
    <Text size="md" bold ellipsis data-underline-on-hover>
      {replay.user.display_name || t('Anonymous User')}
    </Text>
  );

  return (
    <Flex gap="md" align="center" justify="center">
      <UserAvatar
        user={{
          username: replay.user?.display_name || '',
          email: replay.user?.email || '',
          id: replay.user?.id || '',
          ip_address: replay.user?.ip || '',
          name: replay.user?.username || '',
        }}
        size={24}
      />

      <Flex direction="column" gap="xs" justify="center">
        <Flex direction="row" align="center" gap="sm">
          {/* We use div here because the Text component has width 100% and will take up the
          full width of the container, causing a gap between the text and the badge */}
          {replaysIndexUrl ? (
            <Link to={replaysIndexUrl}>{replaysIndexLinkText}</Link>
          ) : (
            <div>{replaysIndexLinkText}</div>
          )}
        </Flex>

        <Flex gap="sm">
          <Flex gap="xs" align="center">
            <IconCalendar variant="muted" size="xs" />

            <Text size="sm" variant="muted">
              {timestampType === 'absolute' ? (
                <DateTime year timeZone date={replay.started_at} />
              ) : (
                <TimeSince date={replay.started_at} />
              )}
            </Text>
          </Flex>
          {isLive ? <LiveBadge /> : null}
        </Flex>
      </Flex>
    </Flex>
  );
}

function getUserSearchQuery({user}: {user: ReplayRecord['user']}) {
  if (!user) {
    return null;
  }

  // Prefer email over id for search query
  if (user.email) {
    return `user.email:"${user.email}"`;
  }
  if (user.id) {
    return `user.id:"${user.id}"`;
  }
  return null;
}
