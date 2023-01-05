import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import {StringWalker} from 'sentry/components/replays/walker/urlWalker';
import ScoreBar from 'sentry/components/scoreBar';
import TimeSince from 'sentry/components/timeSince';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import {IconCalendar} from 'sentry/icons';
import space from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysFromTransaction';
import type {VisibleColumns} from 'sentry/views/replays/replayTable/types';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  column: keyof VisibleColumns;
  eventView: EventView;
  organization: Organization;
  referrer: string;
  replay: ReplayListRecord | ReplayListRecordWithTx;
};

function TableCell({column, eventView, organization, referrer, replay}: Props) {
  const location = useLocation();
  const {projects} = useProjects();
  const project = projects.find(p => p.id === replay.projectId);

  switch (column) {
    case 'session':
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
              {replay.user.displayName || ''}
            </Link>
          }
          user={{
            username: replay.user.displayName || '',
            email: replay.user.email || '',
            id: replay.user.id || '',
            ip_address: replay.user.ip_address || '',
            name: replay.user.name || '',
          }}
          // this is the subheading for the avatar, so displayEmail in this case is a misnomer
          displayEmail={<StringWalker urls={replay.urls} />}
        />
      );

    case 'projectId':
      return (
        <Item>{project ? <ProjectBadge project={project} avatarSize={16} /> : null}</Item>
      );

    case 'slowestTransaction': {
      const hasTxEvent = 'txEvent' in replay;
      const txDuration = hasTxEvent
        ? replay.txEvent?.['transaction.duration']
        : undefined;
      return (
        <Item>
          {hasTxEvent ? (
            <SpanOperationBreakdown>
              {txDuration ? <TxDuration>{txDuration}ms</TxDuration> : null}
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
          ) : null}
        </Item>
      );
    }

    case 'startedAt':
      return (
        <Item>
          <TimeSinceWrapper>
            <StyledIconCalendarWrapper color="gray500" size="sm" />
            <TimeSince date={replay.startedAt} />
          </TimeSinceWrapper>
        </Item>
      );

    case 'duration':
      return (
        <Item>
          <Duration seconds={replay.duration.asSeconds()} exact abbreviation />
        </Item>
      );

    case 'countErrors':
      return (
        <Item data-test-id="replay-table-count-errors">{replay.countErrors || 0}</Item>
      );

    case 'activity': {
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

    default:
      return null;
  }
}

const Item = styled('div')`
  display: flex;
  align-items: center;
`;

const SpanOperationBreakdown = styled('div')`
  width: 100%;
  text-align: right;
`;

const TxDuration = styled('div')`
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(0.5)};
`;

const TimeSinceWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, minmax(auto, max-content));
  align-items: center;
  gap: ${space(1)};
`;

const StyledIconCalendarWrapper = styled(IconCalendar)`
  position: relative;
  top: -1px;
`;

export default TableCell;
