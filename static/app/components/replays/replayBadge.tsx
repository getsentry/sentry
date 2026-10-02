import styled from '@emotion/styled';
import invariant from 'invariant';

import {ProjectAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LiveBadge, useLiveBadge} from 'sentry/components/replays/replayLiveIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons/iconCalendar';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import * as events from 'sentry/utils/events';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import type {ReplayListRecord} from 'sentry/views/explore/replays/types';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';

interface Props {
  replay: ReplayListRecord | ReplayListRecordWithTx;
}

export function ReplayBadge({replay}: Props) {
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
          <IconDelete variant="primary" size="md" />
        </Flex>

        <Stack gap="xs" justify="center">
          <Text size="md" bold>
            {t('Deleted Replay')}
          </Text>
          <Flex gap="xs" align="center">
            {project ? <ProjectAvatar size={12} project={project} /> : null}
            <Text size="sm" variant="muted">
              {events.getShortEventId(replay.id)}
            </Text>
          </Flex>
        </Stack>
      </Grid>
    );
  }

  invariant(
    replay.started_at,
    'For TypeScript: replay.started_at is implied because replay.is_archived is false'
  );

  return (
    <Wrapper columns="24px minmax(0, 1fr)" gap="md" align="center" justify="center">
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

      <Stack gap="xs" justify="center" minWidth="0">
        <Flex direction="row" align="center" gap="xs">
          <Container minWidth="0">
            <Text size="md" bold ellipsis data-underline-on-hover>
              {replay.user.display_name || t('Anonymous User')}
            </Text>
          </Container>
          {isLive ? <LiveBadge /> : null}
        </Flex>

        <Flex gap="xs" wrap="wrap">
          {/* Avatar is used instead of ProjectBadge because using ProjectBadge increases spacing, which doesn't look as good */}
          {project ? (
            <Flex gap="xs" align="center" minWidth="0" maxWidth="100%">
              <ProjectAvatar size={12} project={project} />
              <Text size="sm" variant="muted" ellipsis>
                {project.slug}
              </Text>
            </Flex>
          ) : null}
          <Text size="sm" variant="muted">
            {events.getShortEventId(replay.id)}
          </Text>
          {/* z-index lifts the timestamp above the row's ::before click target
             (from SimpleTable.rowLinkStyle) so the TimeSince tooltip can trigger */}
          <Flex
            gap="xs"
            align="center"
            minWidth="0"
            position="relative"
            style={{zIndex: 1}}
          >
            <IconCalendar variant="muted" size="xs" />
            <Text size="sm" variant="muted" wrap="normal">
              {timestampType === 'absolute' ? (
                <DateTime year timeZone date={replay.started_at} />
              ) : (
                <TimeSince date={replay.started_at} />
              )}
            </Text>
          </Flex>
        </Flex>
      </Stack>
    </Wrapper>
  );
}

const Wrapper = styled(Grid)`
  white-space: nowrap;
`;
