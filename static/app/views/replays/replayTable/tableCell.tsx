import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import {StringWalker} from 'sentry/components/replays/walker/urlWalker';
import ScoreBar from 'sentry/components/scoreBar';
import TimeSince from 'sentry/components/timeSince';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  replay: ReplayListRecord | ReplayListRecordWithTx;
};

export function SessionCell({
  eventView,
  organization,
  referrer,
  replay,
}: Props & {eventView: EventView; organization: Organization; referrer: string}) {
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

export function ProjectCell({replay}: Props) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === replay.project_id);

  return (
    <Item>{project ? <ProjectBadge project={project} avatarSize={16} /> : null}</Item>
  );
}

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

export function StartedAtCell({replay}: Props) {
  return (
    <Item>
      <TimeSince date={replay.started_at} />
    </Item>
  );
}

export function DurationCell({replay}: Props) {
  return (
    <Item>
      <Duration seconds={replay.duration.asSeconds()} exact abbreviation />
    </Item>
  );
}

export function ErrorCountCell({replay}: Props) {
  return <Item data-test-id="replay-table-count-errors">{replay.count_errors || 0}</Item>;
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
