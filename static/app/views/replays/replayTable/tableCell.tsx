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
import {IconCalendar} from 'sentry/icons';
import {space, ValidSize} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  replay: ReplayListRecord | ReplayListRecordWithTx;
};

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

  return (
    <Item>
      <UserBadgeFullWidth
        avatarSize={24}
        displayName={
          <MainLink to={replayDetails}>{replay.user.display_name || ''}</MainLink>
        }
        user={{
          username: replay.user.display_name || '',
          email: replay.user.email || '',
          id: replay.user.id || '',
          ip_address: replay.user.ip || '',
          name: replay.user.username || '',
        }}
        // this is the subheading for the avatar, so displayEmail in this case is a misnomer
        displayEmail={
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
        }
      />
    </Item>
  );
}

// Need to be full width for StringWalker to take up full width and truncate properly
const UserBadgeFullWidth = styled(UserBadge)`
  width: 100%;
`;

const Cols = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  width: 100%;
`;

const Row = styled('div')<{gap: ValidSize}>`
  display: flex;
  gap: ${p => space(p.gap)};
  align-items: center;
`;

const MainLink = styled(Link)`
  font-size: ${p => p.theme.fontSizeLarge};
`;

export function TransactionCell({
  organization,
  replay,
}: Props & {organization: Organization}) {
  const location = useLocation();

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
  const {name, version} = replay.os;

  return (
    <Item>
      <ContextIcon name={name ?? ''} version={version ?? undefined} />
    </Item>
  );
}

export function BrowserCell({replay}: Props) {
  const {name, version} = replay.browser;
  return (
    <Item>
      <ContextIcon name={name ?? ''} version={version ?? undefined} />
    </Item>
  );
}

export function DurationCell({replay}: Props) {
  return (
    <Item>
      <Time>{formatTime(replay.duration.asMilliseconds())}</Time>
    </Item>
  );
}

export function ErrorCountCell({replay}: Props) {
  return (
    <Item data-test-id="replay-table-count-errors">
      <ErrorCount countErrors={replay.count_errors} />
    </Item>
  );
}

export function ActivityCell({replay}: Props) {
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

const Item = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(1.5)};
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
