import {useMemo} from 'react';
import {Link} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Avatar from 'sentry/components/avatar';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import {formatTime} from 'sentry/components/replays/utils';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
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

interface FetchOptions {
  userId: string;
  limit?: number;
}

interface ErrorEvent {
  'browser.name': string | null;
  'browser.version': string | null;
  'event.type': 'transaction' | 'error' | 'default';
  id: string;
  message: string;
  'os.name': string | null;
  'os.version': string | null;
  project: string;
  'project.id': string;
  timestamp: string;
}
interface FetchEventsResponse {
  data: ErrorEvent[];
  meta: any;
}

interface TransactionEvent extends ErrorEvent {
  'span_ops_breakdown.relative': string;
  'spans.browser': number | null;
  'spans.db': number | null;
  'spans.http': number | null;
  'spans.resource': number | null;
  'spans.ui': number | null;
  'transaction.duration': number | null;
}
interface FetchTransactionResponse {
  data: TransactionEvent[];
  meta: any;
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
            <Link
              to={`/organizations/${organization.slug}/performance/${event.project}:${event.id}/`}
            >
              {event.message}
            </Link>{' '}
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
  ].sort((a, b) => +a.timestamp - +b.timestamp);

  return (
    <TimelinePanel>
      <TimelineScrollWrapper>
        <Timeline>
          {allResults.map(results => {
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
        </Timeline>
      </TimelineScrollWrapper>
    </TimelinePanel>
  );
}

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
        <Timestamp>{timestamp.toISOString()}</Timestamp>
      </EventWrapper>
    </div>
  );
}

const Timeline = styled('div')``;

const TimelinePanel = styled(Panel)`
  flex: 1;
  overflow: auto;
`;

const EventContent = styled('div')`
  display: flex;
  gap: ${space(1)};
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

function useFetchReplays({userId, limit = 5}: FetchOptions) {
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

function useFetchErrors(options: FetchOptions) {
  return useFetchEvents<FetchEventsResponse>({...options, type: 'error'});
}

function useFetchTransactions(options: FetchOptions) {
  return useFetchEvents<FetchTransactionResponse>({...options, type: 'transaction'});
}

function useFetchEvents<T extends FetchEventsResponse>({
  userId,
  type,
  limit = 5,
}: {
  type: 'error' | 'transaction';
  userId: string;
  limit?: number;
}) {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValue('user.id', userId);
    conditions.addFilterValue('event.type', type);

    const fields = [
      'message',
      'timestamp',
      'event.type',
      'project.id',
      'project',
      'os.name',
      'os.version',
      'browser.name',
      'browser.version',
    ];

    if (type === 'transaction') {
      fields.push('transaction.duration');
      fields.push('span_ops_breakdown.relative');
      fields.push('spans.browser');
      fields.push('spans.db');
      fields.push('spans.http');
      fields.push('spans.resource');
      fields.push('spans.ui');
      fields.push('transaction.duration');
    }

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields,
        projects: [],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, '-timestamp'),
      },
      location
    );
  }, [location, userId, type]);

  const payload = eventView.getEventsAPIPayload(location);
  payload.per_page = limit;

  const results = useApiQuery<T>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...payload,
          queryReferrer: 'issueReplays',
        },
      },
    ],
    {staleTime: 0}
  );

  return {
    events: results.data?.data,
    isFetching: results.isLoading,
    fetchError: results.error,
    eventView,
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
