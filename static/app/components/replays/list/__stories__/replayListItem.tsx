import styled from '@emotion/styled';
import invariant from 'invariant';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons/iconCalendar';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getShortEventId} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  onClick: () => void;
  replay: ReplayListRecord | ReplayListRecordWithTx;
  rowIndex: number;
}

export default function ReplayListItem({replay, onClick}: Props) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: replay.project_id ?? undefined});

  const replayDetailsPathname = makeReplaysPathname({
    path: `/${replay.id}/`,
    organization,
  });

  if (replay.is_archived) {
    return (
      <Flex gap="md" align="center" justify="center">
        <ArchivedWrapper>
          <IconDelete variant="primary" size="md" />
        </ArchivedWrapper>

        <Flex direction="column" gap="xs">
          <DisplayName>{t('Deleted Replay')}</DisplayName>
          <Flex gap="xs" align="center">
            {project ? <ProjectAvatar size={12} project={project} /> : null}
            <Text size="sm">{getShortEventId(replay.id)}</Text>
          </Flex>
        </Flex>
      </Flex>
    );
  }

  invariant(
    replay.started_at,
    'For TypeScript: replay.started_at is implied because replay.is_archived is false'
  );

  return (
    <CardSpacing>
      <a
        href={replayDetailsPathname}
        onClick={e => {
          e.preventDefault();
          onClick();
        }}
      >
        <Flex align="center" gap="md" padding="xs">
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
          <SubText>
            <Flex gap="xs" align="start">
              <DisplayName data-underline-on-hover>
                {replay.user.display_name || t('Anonymous User')}
              </DisplayName>
            </Flex>
            <Flex gap="xs">
              {/* Avatar is used instead of ProjectBadge because using ProjectBadge increases spacing, which doesn't look as good */}
              {project ? <ProjectAvatar size={12} project={project} /> : null}
              {project ? <span>{project.slug}</span> : null}
              <span>{getShortEventId(replay.id)}</span>
              <Flex gap="xs">
                <IconCalendar variant="muted" size="xs" />
                <TimeSince date={replay.started_at} />
              </Flex>
            </Flex>
          </SubText>
          <InteractionStateLayer />
        </Flex>
      </a>
    </CardSpacing>
  );
}

const CardSpacing = styled('div')`
  position: relative;
  padding: ${space(0.5)} ${space(0.5)} 0 ${space(0.5)};
`;

const ArchivedWrapper = styled(Flex)`
  width: ${p => p.theme.space['2xl']};
  align-items: center;
  justify-content: center;
`;

const SubText = styled('div')`
  font-size: 0.875em;
  line-height: normal;
  color: ${p => p.theme.tokens.content.secondary};
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  align-items: flex-start;
`;

const DisplayName = styled('span')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: normal;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;
