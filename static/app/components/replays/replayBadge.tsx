import styled from '@emotion/styled';
import invariant from 'invariant';

import {Tooltip} from '@sentry/scraps/tooltip';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Grid} from 'sentry/components/core/layout';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import {DateTime} from 'sentry/components/dateTime';
import {
  LIVE_TOOLTIP_MESSAGE,
  LiveIndicator,
  useLiveBadge,
} from 'sentry/components/replays/replayLiveIndicator';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons/iconCalendar';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import * as events from 'sentry/utils/events';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  replay: ReplayListRecord | ReplayListRecordWithTx;
}

export default function ReplayBadge({replay}: Props) {
  const project = useProjectFromId({project_id: replay.project_id ?? undefined});
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
          <IconDelete color="gray500" size="md" />
        </Flex>

        <Flex direction="column" gap="xs" justify="center">
          <Text size="md" bold>
            {t('Deleted Replay')}
          </Text>
          <Flex gap="xs" align="center">
            {project ? <ProjectAvatar size={12} project={project} /> : null}
            <Text size="sm" variant="muted">
              {events.getShortEventId(replay.id)}
            </Text>
          </Flex>
        </Flex>
      </Grid>
    );
  }

  invariant(
    replay.started_at,
    'For TypeScript: replay.started_at is implied because replay.is_archived is false'
  );

  return (
    <Wrapper columns="24px 1fr" gap="md" align="center" justify="center">
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
        <Flex direction="row" align="center">
          <div>
            <Text size="md" bold ellipsis data-underline-on-hover>
              {replay.user.display_name || t('Anonymous User')}
            </Text>
          </div>
          {isLive ? (
            <Tooltip title={LIVE_TOOLTIP_MESSAGE}>
              <LiveIndicator />
            </Tooltip>
          ) : null}
        </Flex>

        <Flex gap="xs">
          {/* Avatar is used instead of ProjectBadge because using ProjectBadge increases spacing, which doesn't look as good */}
          {project ? <ProjectAvatar size={12} project={project} /> : null}
          {project ? (
            <Text size="sm" variant="muted">
              {project.slug}
            </Text>
          ) : null}
          <Text size="sm" variant="muted">
            {events.getShortEventId(replay.id)}
          </Text>
          <Flex gap="xs" align="center">
            <IconCalendar color="gray300" size="xs" />
            <Text size="sm" variant="muted">
              {timestampType === 'absolute' ? (
                <DateTime year timeZone date={replay.started_at} />
              ) : (
                <TimeSince date={replay.started_at} />
              )}
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </Wrapper>
  );
}

const Wrapper = styled(Grid)`
  white-space: nowrap;
`;
