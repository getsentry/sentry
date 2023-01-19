import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import {
  StringWalker,
  StringWalkerSummary,
} from 'sentry/components/replays/walker/urlWalker';
import ScoreBar from 'sentry/components/scoreBar';
import TimeSince from 'sentry/components/timeSince';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import space from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysFromTransaction';
import {ReplayColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type BaseProps = {
  replay: ReplayListRecord | ReplayListRecordWithTx;
};

type Props = BaseProps & {
  column: keyof typeof ReplayColumns;
  eventView: EventView;
  organization: Organization;
  referrer: string;
};

export default function TableCell({
  column,
  eventView,
  organization,
  referrer,
  replay,
}: Props) {
  switch (column) {
    case ReplayColumns.user:
      return (
        <UserCell
          key="user"
          replay={replay}
          eventView={eventView}
          organization={organization}
          referrer={referrer}
        />
      );

    case ReplayColumns.session:
      return (
        <SessionCell
          key="session"
          replay={replay}
          eventView={eventView}
          organization={organization}
          referrer={referrer}
        />
      );
    case ReplayColumns.projectId:
      return <ProjectCell key="projectId" replay={replay} />;
    case ReplayColumns.slowestTransaction:
      return (
        <TransactionCell
          key="slowestTransaction"
          replay={replay}
          organization={organization}
        />
      );
    case ReplayColumns.startedAt:
      return <StartedAtCell key="startedAt" replay={replay} />;
    case ReplayColumns.duration:
      return <DurationCell key="duration" replay={replay} />;
    case ReplayColumns.countErrors:
      return <ErrorCountCell key="countErrors" replay={replay} />;
    case ReplayColumns.activity:
      return <ActivityCell key="activity" replay={replay} />;
    default:
      return null;
  }
}

function UserCell({
  eventView,
  organization,
  referrer,
  replay,
}: BaseProps & {eventView: EventView; organization: Organization; referrer: string}) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === replay.project_id);

  return (
    <UserBadge
      avatarSize={32}
      displayName={
        <Link
          to={{
            pathname: `/organizations/${organization.slug}/replays/${project?.slug}:${replay.id}/`,
            query: {
              referrer,
              ...eventView.generateQueryStringObject(),
            },
          }}
        >
          {replay.user.display_name || ''}
        </Link>
      }
      user={{
        username: replay.user.display_name || '',
        email: replay.user.email || '',
        id: replay.user.id || '',
        ip_address: replay.user.ip || '',
        name: replay.user.username || '',
      }}
      // this is the subheading for the avatar, so displayEmail in this case is a misnomer
      displayEmail={<StringWalkerSummary urls={replay.urls} />}
    />
  );
}

function SessionCell({
  eventView,
  organization,
  referrer,
  replay,
}: BaseProps & {eventView: EventView; organization: Organization; referrer: string}) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === replay.project_id);

  return (
    <UserBadge
      avatarSize={32}
      displayName={
        <Link
          to={{
            pathname: `/organizations/${organization.slug}/replays/${project?.slug}:${replay.id}/`,
            query: {
              referrer,
              ...eventView.generateQueryStringObject(),
            },
          }}
        >
          {replay.user.display_name || ''}
        </Link>
      }
      user={{
        username: replay.user.display_name || '',
        email: replay.user.email || '',
        id: replay.user.id || '',
        ip_address: replay.user.ip || '',
        name: replay.user.username || '',
      }}
      // this is the subheading for the avatar, so displayEmail in this case is a misnomer
      displayEmail={<StringWalker urls={replay.urls} />}
    />
  );
}

function ProjectCell({replay}: BaseProps) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === replay.project_id);

  return (
    <Item>{project ? <ProjectBadge project={project} avatarSize={16} /> : null}</Item>
  );
}

function TransactionCell({
  organization,
  replay,
}: BaseProps & {organization: Organization}) {
  const location = useLocation();

  const hasTxEvent = 'txEvent' in replay;
  const txDuration = hasTxEvent ? replay.txEvent?.['transaction.duration'] : undefined;
  return hasTxEvent ? (
    <SpanOperationBreakdown>
      {txDuration ? <div>{txDuration}ms</div> : null}
      {spanOperationRelativeBreakdownRenderer(
        replay.txEvent,
        {
          organization,
          location,
        },
        {
          enableOnClick: false,
        }
      )}
    </SpanOperationBreakdown>
  ) : null;
}

function StartedAtCell({replay}: BaseProps) {
  return (
    <Item>
      <TimeSince date={replay.started_at} />
    </Item>
  );
}

function DurationCell({replay}: BaseProps) {
  return (
    <Item>
      <Duration seconds={replay.duration.asSeconds()} exact abbreviation />
    </Item>
  );
}

function ErrorCountCell({replay}: BaseProps) {
  return <Item data-test-id="replay-table-count-errors">{replay.count_errors || 0}</Item>;
}

function ActivityCell({replay}: BaseProps) {
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
