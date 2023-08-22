import {Fragment} from 'react';
import {Link} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Avatar from 'sentry/components/avatar';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import {formatTime} from 'sentry/components/replays/utils';
import TextOverflow from 'sentry/components/textOverflow';
import {space} from 'sentry/styles/space';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {useFetchErrors, useFetchTransactions} from '../useFetchEvents';
import {useFetchReplays} from '../useFetchReplays';

import {Liner} from './liner';

interface Props {
  userId: string;
}

export function UserTimeline({userId}: Props) {
  const location = useLocation();
  const replayResults = useFetchReplays({userId});
  const errorResults = useFetchErrors({userId, limit: 100});
  const transactionResults = useFetchTransactions({userId, limit: 100});
  const organization = useOrganization();
  const theme = useTheme();

  if (
    replayResults.isFetching ||
    errorResults.isFetching ||
    transactionResults.isFetching
  ) {
    return <Placeholder height="100vh" />;
  }

  if (
    replayResults.fetchError ||
    !replayResults.replays ||
    errorResults.fetchError ||
    transactionResults.fetchError
  ) {
    return <div>Error fetching user profile</div>;
  }

  const allResults = [
    ...(replayResults.replays || []).map(replay => ({
      id: replay.id,
      content: (
        <div>
          Started replay{' '}
          <Link to={`/organizations/${organization.slug}/replays/${replay.id}/`}>
            {getShortEventId(replay.id)}
          </Link>{' '}
          ({formatTime(Number(replay.duration))})
        </div>
      ),
      type: 'replay',
      speed: null,
      timestamp: new Date(replay.started_at),
      project: replayResults.projects.get(`${replay.project_id}`),
    })),
    ...(transactionResults.events || []).map(event => {
      const duration = event['transaction.duration'];
      const speed = !duration
        ? null
        : duration <= 1500
        ? 'fast'
        : duration <= 5000
        ? 'mid'
        : 'slow';
      const css = {} as any;
      if (speed === 'fast') {
        css.color = theme.green300;
      } else if (speed === 'mid') {
        css.color = theme.yellow300;
      } else if (speed === 'slow') {
        css.color = theme.red400;
      }

      return {
        id: event.id,
        content: (
          <TransactionContent>
            <TextOverflow>
              <Link
                to={`/organizations/${organization.slug}/performance/${event.project}:${event.id}/`}
              >
                {event.message}
              </Link>
            </TextOverflow>
            <span style={css}>{duration}ms</span>
            {spanOperationRelativeBreakdownRenderer(event, {
              location,
              organization,
              eventView: transactionResults.eventView,
            })}
          </TransactionContent>
        ),
        speed,
        timestamp: new Date(event.timestamp),
        type: event['event.type'],
        project: replayResults.projects.get(`${event['project.id']}`),
      };
    }),
    ...(errorResults.events || []).map(event => ({
      id: event.id,
      content: (
        <div>
          <Link to={`/organizations/${organization.slug}/replays/${event.id}/`}>
            {event.message}
          </Link>{' '}
        </div>
      ),
      speed: null,
      timestamp: new Date(event.timestamp),
      type: event['event.type'],
      project: replayResults.projects.get(`${event['project.id']}`),
    })),
  ].sort((a, b) => +b.timestamp - +a.timestamp);

  const groupedByDay = allResults.reduce((acc, result) => {
    const day = new Date(result.timestamp).toLocaleDateString('en-US', {
      dateStyle: 'long',
    });
    if (!acc.has(day)) {
      acc.set(day, []);
    }
    const arr = acc.get(day) ?? [];
    arr.push(result);
    acc.set(day, arr);
    return acc;
  }, new Map<string, typeof allResults>());

  return (
    <TimelinePanel>
      <TimelineScrollWrapper>
        <Timeline>
          {Object.entries(Object.fromEntries(groupedByDay)).map(([day, dayResults]) => (
            <Fragment key={day}>
              <Day>{day}</Day>
              {dayResults.map(results => {
                return (
                  <TimelineEvent
                    key={results.id}
                    timestamp={results.timestamp}
                    project={results.project}
                    // @ts-expect-error
                    speed={results.speed}
                    // @ts-expect-error
                    type={results.type}
                  >
                    {results.content}
                  </TimelineEvent>
                );
              })}
            </Fragment>
          ))}
        </Timeline>
      </TimelineScrollWrapper>
    </TimelinePanel>
  );
}
const Day = styled('div')`
  color: ${p => p.theme.subText};
  font-weight: bold;
  position: sticky;
  top: 0;
  background: ${p => p.theme.surface400};
  padding: ${space(1)};
  z-index: 2;
`;

interface TimelineEventProps {
  children: React.ReactNode;
  project: any;
  speed: null | 'fast' | 'mid' | 'slow';
  timestamp: Date;
  type: 'replay' | 'error' | 'transaction' | 'default';
  className?: string;
}

function UnstyledTimelineEvent({
  className,
  children,
  timestamp,
  project,
  speed,
  type,
}: TimelineEventProps) {
  const theme = useTheme();
  const isError = type === 'error';
  const style = {
    '--background': `${isError ? theme.red100 : 'inherit'}`,
  } as any;

  return (
    <div style={style} className={className}>
      <Liner type={type} speed={speed} />
      <EventWrapper>
        <EventContent>
          <Avatar round project={project} />
          {children}
        </EventContent>
        <Timestamp>{formatTimestamp(timestamp)}</Timestamp>
      </EventWrapper>
    </div>
  );
}

const Timeline = styled('div')`
  position: relative;
`;

const TimelinePanel = styled(Panel)`
  flex: 1;
  overflow: auto;
`;

const EventContent = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex: 1;
  padding: ${space(1.5)} 0;
`;
const EventWrapper = styled('div')`
  flex: 1;
  display: flex;
  gap: ${space(1)};
  align-items: center;
  flex-shrink: 0;
`;

const TimelineEvent = styled(UnstyledTimelineEvent)`
  display: flex;
  gap: ${space(2)};
  background-color: var(--background);
  padding: 0 ${space(1.5)};
`;

const TimelineScrollWrapper = styled(PanelBody)``;

const TransactionContent = styled('div')`
  display: grid;
  flex: 1;
  grid-template-columns: auto max-content 25%;
  gap: ${space(1)};
  align-items: center;
`;

const Timestamp = styled('span')`
  color: ${p => p.theme.gray300};
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.7rem;
`;

function formatTimestamp(date: Date) {
  return `${date.toLocaleTimeString('en-US', {hour12: false})}`;
}
