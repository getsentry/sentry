import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import {StringWalker} from 'sentry/components/replays/walker/urlWalker';
import ScoreBar from 'sentry/components/scoreBar';
import TimeSince from 'sentry/components/timeSince';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import space from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
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
    case ReplayColumns.dateTime:
      return (
        <DateTimeCell
          key="datetime"
          eventView={eventView}
          organization={organization}
          referrer={referrer}
          replay={replay}
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
    case ReplayColumns.countUrls:
      return <UrlCountCell key="countUrls" replay={replay} />;
    case ReplayColumns.activity:
      return <ActivityCell key="activity" replay={replay} />;
    default:
      return null;
  }
}

function DateTimeCell({
  eventView,
  organization,
  referrer,
  replay,
}: BaseProps & {eventView: EventView; organization: Organization; referrer: string}) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === replay.project_id);

  return (
    <Item>
      <Link
        to={{
          pathname: `/organizations/${organization.slug}/replays/${project?.slug}:${replay.id}/`,
          query: {
            referrer,
            ...eventView.generateQueryStringObject(),
          },
        }}
      >
        <DateTime date={replay.started_at} seconds timeZone />
      </Link>
    </Item>
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
    <Item padding={space(2)}>
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
    </Item>
  );
}

function ProjectCell({replay}: BaseProps) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === replay.project_id);

  return project ? (
    <Item>
      <ProjectBadge project={project} avatarSize={16} />
    </Item>
  ) : null;
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
    <Item numeric>
      <Duration seconds={replay.duration.asSeconds()} exact abbreviation />
    </Item>
  );
}

function ErrorCountCell({replay}: BaseProps) {
  return <Item numeric>{replay.count_errors || 0}</Item>;
}

function UrlCountCell({replay}: BaseProps) {
  return <Item numeric>{replay.count_urls || 0}</Item>;
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

const Item = styled('span')<{numeric?: boolean; padding?: ReturnType<typeof space>}>`
  ${p => p.theme.overflowEllipsis};
  display: flex;
  align-items: center;
  height: 100%;
  gap: ${space(1)};
  padding: ${p => (p.padding ? p.padding : `${space(0.5)} ${space(1)}`)};
  ${p => (p.numeric ? 'justify-content: flex-end;' : '')}
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
