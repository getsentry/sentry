import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Avatar from 'sentry/components/avatar';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import ContextIcon from 'sentry/components/replays/contextIcon';
import ErrorCount from 'sentry/components/replays/header/errorCount';
import {formatTime} from 'sentry/components/replays/utils';
import {StringWalker} from 'sentry/components/replays/walker/urlWalker';
import ScoreBar from 'sentry/components/scoreBar';
import TimeSince from 'sentry/components/timeSince';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import {IconCalendar, IconDelete, IconLocation} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space, ValidSize} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  replay: ReplayListRecord | ReplayListRecordWithTx;
};

function getUserBadgeUser(replay: Props['replay']) {
  return replay.is_archived
    ? {
        username: '',
        email: '',
        id: '',
        ip_address: '',
        name: '',
      }
    : {
        username: replay.user?.display_name || '',
        email: replay.user?.email || '',
        id: replay.user?.id || '',
        ip_address: replay.user?.ip || '',
        name: replay.user?.username || '',
      };
}

export function ReplayCell({
  eventView,
  organization,
  referrer,
  replay,
}: Props & {eventView: EventView; organization: Organization; referrer: string}) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === replay.project_id);

  const replayDetails = {
    pathname: `/organizations/${organization.slug}/replays/${project?.slug}:${replay.id}/`,
    query: {
      referrer,
      ...eventView.generateQueryStringObject(),
    },
  };

  if (replay.is_archived) {
    return (
      <Item isArchived={replay.is_archived}>
        <Row gap={1}>
          <StyledIconDelete color="gray500" size="md" />
          <div>
            <Row gap={0.5}>{t('Deleted Replay')}</Row>
            <Row gap={0.5}>
              {project ? <Avatar size={12} project={project} /> : null}
              {getShortEventId(replay.id)}
            </Row>
          </div>
        </Row>
      </Item>
    );
  }

  const subText = replay.urls ? (
    <Cols>
      <StringWalker urls={replay.urls} />
      <Row gap={1}>
        <Row gap={0.5}>
          {project ? <Avatar size={12} project={project} /> : null}
          <Link to={replayDetails}>{getShortEventId(replay.id)}</Link>
        </Row>
        <Row gap={0.5}>
          <IconCalendar color="gray300" size="xs" />
          <TimeSince date={replay.started_at} />
        </Row>
      </Row>
    </Cols>
  ) : (
    <Cols>
      <Row gap={1}>
        <Row gap={0.5} minWidth={80}>
          {project ? <Avatar size={12} project={project} /> : null}
          <Link to={replayDetails}>{getShortEventId(replay.id)}</Link>
        </Row>
        <Row gap={0.5} minWidth={80}>
          <IconLocation color="green400" size="sm" />
          {tn('%s Page', '%s Pages', replay.count_urls)}
        </Row>
        <Row gap={0.5}>
          <IconCalendar color="gray300" size="xs" />
          <TimeSince date={replay.started_at} />
        </Row>
      </Row>
    </Cols>
  );

  return (
    <Item>
      <UserBadgeFullWidth
        avatarSize={24}
        displayName={
          replay.is_archived ? (
            replay.user?.display_name || t('Unknown User')
          ) : (
            <MainLink to={replayDetails}>
              {replay.user?.display_name || t('Unknown User')}
            </MainLink>
          )
        }
        user={getUserBadgeUser(replay)}
        // this is the subheading for the avatar, so displayEmail in this case is a misnomer
        displayEmail={subText}
      />
    </Item>
  );
}

const StyledIconDelete = styled(IconDelete)`
  margin: ${space(0.25)};
`;

// Need to be full width for StringWalker to take up full width and truncate properly
const UserBadgeFullWidth = styled(UserBadge)`
  width: 100%;
`;

const Cols = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  width: 100%;
`;

const Row = styled('div')<{gap: ValidSize; minWidth?: number}>`
  display: flex;
  gap: ${p => space(p.gap)};
  align-items: center;
  ${p => (p.minWidth ? `min-width: ${p.minWidth}px;` : '')}
`;

const MainLink = styled(Link)`
  font-size: ${p => p.theme.fontSizeLarge};
`;

export function TransactionCell({
  organization,
  replay,
}: Props & {organization: Organization}) {
  const location = useLocation();

  if (replay.is_archived) {
    return <Item isArchived />;
  }
  const hasTxEvent = 'txEvent' in replay;
  const txDuration = hasTxEvent ? replay.txEvent?.['transaction.duration'] : undefined;
  return hasTxEvent ? (
    <SpanOperationBreakdown>
      {txDuration ? <div>{txDuration}ms</div> : null}
      {spanOperationRelativeBreakdownRenderer(
        replay.txEvent,
        {organization, location},
        {enableOnClick: false}
      )}
    </SpanOperationBreakdown>
  ) : null;
}

export function OSCell({replay}: Props) {
  const {name, version} = replay.os ?? {};
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.large})`);

  if (replay.is_archived) {
    return <Item isArchived />;
  }
  return (
    <Item>
      <ContextIcon
        name={name ?? ''}
        version={version && hasRoomForColumns ? version : undefined}
      />
    </Item>
  );
}

export function BrowserCell({replay}: Props) {
  const {name, version} = replay.browser ?? {};
  const theme = useTheme();
  const hasRoomForColumns = useMedia(`(min-width: ${theme.breakpoints.large})`);

  if (replay.is_archived) {
    return <Item isArchived />;
  }
  return (
    <Item>
      <ContextIcon
        name={name ?? ''}
        version={version && hasRoomForColumns ? version : undefined}
      />
    </Item>
  );
}

export function DurationCell({replay}: Props) {
  if (replay.is_archived) {
    return <Item isArchived />;
  }
  return (
    <Item>
      <Time>{formatTime(replay.duration.asMilliseconds())}</Time>
    </Item>
  );
}

export function ErrorCountCell({replay}: Props) {
  if (replay.is_archived) {
    return <Item isArchived />;
  }
  return (
    <Item data-test-id="replay-table-count-errors">
      <ErrorCount countErrors={replay.count_errors} />
    </Item>
  );
}

export function ActivityCell({replay}: Props) {
  if (replay.is_archived) {
    return <Item isArchived />;
  }
  const scoreBarPalette = new Array(10).fill([CHART_PALETTE[0][0]]);
  return (
    <Item>
      <ScoreBar
        size={20}
        score={replay?.activity ?? 1}
        palette={scoreBarPalette}
        radius={0}
      />
    </Item>
  );
}

const Item = styled('div')<{isArchived?: boolean}>`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(1.5)};
  ${p => (p.isArchived ? 'opacity: 0.5;' : '')};
`;

const Time = styled('span')`
  font-variant-numeric: tabular-nums;
`;

const SpanOperationBreakdown = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeMedium};
  text-align: right;
`;
