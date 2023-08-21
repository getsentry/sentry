import {Fragment, useMemo} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import Avatar from 'sentry/components/avatar';
import Placeholder from 'sentry/components/placeholder';
import {formatTime} from 'sentry/components/replays/utils';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {ReplayListLocationQuery} from 'sentry/views/replays/types';

import {Liner} from './liner';

interface Props {
  userId: string;
}

export function UserTimeline({userId}: Props) {
  const replayResults = useFetchReplays({userId});
  const eventResults = useFetchEvents({userId, limit: 100});
  const organization = useOrganization();

  if (replayResults.isFetching || eventResults.isFetching) {
    return <Placeholder height="100vh" />;
  }

  if (replayResults.fetchError || !replayResults.replays || eventResults.fetchError) {
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
          ({formatTime(replay.duration)})
        </div>
      ),
      type: 'replay',
      timestamp: new Date(replay.started_at),
      project: replayResults.projects.get(`${replay.project_id}`),
    })),
    ...(eventResults.events || []).map(event => ({
      id: event.id,
      content: (
        <div>
          {event.type === 'error' ? 'Error: ' : ''}
          <Link to={`/organizations/${organization.slug}/replays/${event.id}/`}>
            {event.title}
          </Link>{' '}
        </div>
      ),
      timestamp: new Date(event.timestamp),
      type: event.type,
      project: replayResults.projects.get(`${event['project.id']}`),
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <Fragment>
      Timeline
      <TimelineScrollWrapper>
        <Timeline>
          {allResults.map(results => {
            return (
              <TimelineEvent
                key={results.id}
                timestamp={results.timestamp}
                project={results.project}
                type={results.type}
              >
                {results.content}
              </TimelineEvent>
            );
          })}
        </Timeline>
      </TimelineScrollWrapper>
    </Fragment>
  );
}

interface TimelineEventProps {
  children: React.ReactNode;
  project: any;
  timestamp: Date;
  type: 'replay' | 'error' | 'transaction';
  className?: string;
}

function UnstyledTimelineEvent({
  className,
  children,
  timestamp,
  project,
}: TimelineEventProps) {
  return (
    <div className={className}>
      <Liner />
      <EventWrapper>
        <EventContent>{children}</EventContent>
        <Avatar round project={project} />
        <Timestamp>{timestamp.toISOString()}</Timestamp>
      </EventWrapper>
    </div>
  );
}

const EventContent = styled('div')`
  flex: 1;
  padding: ${space(2)} 0;
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
`;

const TimelineScrollWrapper = styled('div')`
  flex: 1;
  overflow: auto;
`;

const Timeline = styled('div')``;

function useFetchReplays({userId, limit = 5}: {userId: string; limit?: number}) {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();
  const {projects} = useProjects();
  const projectsHash = new Map(projects.map(project => [`${project.id}`, project]));

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValue('user.id', userId);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: [
          'activity',
          'browser.name',
          'browser.version',
          'count_dead_clicks',
          'count_errors',
          'count_rage_clicks',
          'duration',
          'finished_at',
          'id',
          'is_archived',
          'os.name',
          'os.version',
          'project_id',
          'started_at',
          'urls',
          'user',
        ],
        projects: [],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, '-started_at'),
      },
      location
    );
  }, [location, userId]);

  const results = useReplayList({
    eventView,
    location,
    organization,
    perPage: limit,
  });

  return {
    ...results,
    projects: projectsHash,
  };
}

const Timestamp = styled('span')`
  color: ${p => p.theme.gray300};
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.85rem;
`;

function useFetchEvents({userId, limit = 5}: {userId: string; limit?: number}) {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValue('user.id', userId);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: [
          'title',
          'timestamp',
          'transaction.duration',
          'event.type',
          'project.id',
          'os.name',
          'os.version',
          'browser.name',
          'browser.version',
        ],
        projects: [],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, '-timestamp'),
      },
      location
    );
  }, [location, userId]);

  const payload = eventView.getEventsAPIPayload(location);
  payload.per_page = limit;

  const results = useApiQuery([
    `/organizations/${organization.slug}/events/`,
    {
      query: {
        ...payload,
        queryReferrer: 'issueReplays',
      },
    },
  ]);

  return {
    events: results.data?.data,
    isFetching: results.isLoading,
    fetchError: results.error,
  };
}
//
// field: title
// field: event.type
// field: project.id
// field: timestamp
// per_page: 50
// project: 11276
// query: user.email%3Abilly%40sentry.io
// referrer: api.discover.query-table
// sort: -timestamp
// statsPeriod: 7d
//
