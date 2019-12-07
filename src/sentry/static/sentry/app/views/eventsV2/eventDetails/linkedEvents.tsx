import React from 'react';
import styled from 'react-emotion';
import {Location} from 'history';

import {Organization, Event, Project} from 'app/types';
import AsyncComponent from 'app/components/asyncComponent';
import DateTime from 'app/components/dateTime';
import Link from 'app/components/links/link';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {t} from 'app/locale';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import withProjects from 'app/utils/withProjects';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Panel} from 'app/components/panels';
import {
  SentryTransactionEvent,
  SpanType,
} from 'app/components/events/interfaces/spans/types';
import TraceView from 'app/components/events/interfaces/spans/traceView';

import {generateEventDetailsRoute, generateEventSlug} from './utils';
import {SectionHeading} from '../styles';
import EventView from '../eventView';

type DiscoverResult = {
  id: string;
  'project.name': string;
  'event.type': string;
  title: string;
  transaction: string;
  timestamp: number;
};

type Props = {
  organization: Organization;
  projectId: string;
  projects: Project[];
  event: Event;
  eventView: EventView;
  location: Location;
} & AsyncComponent['props'];

type State = {
  linkedEvents: {data: DiscoverResult[]};
} & AsyncComponent['state'];

class LinkedEvents extends AsyncComponent<Props, State> {
  getEndpoints(): [string, string, any][] {
    const {event, organization} = this.props;
    const endpoints: any = [];

    const trace = event.tags.find(tag => tag.key === 'trace');
    if (trace) {
      endpoints.push([
        'linkedEvents',
        `/organizations/${organization.slug}/eventsv2/`,
        {
          query: {
            field: [
              'project.name',
              'title',
              'transaction',
              'id',
              'event.type',
              'timestamp',
            ],
            sort: ['-timestamp'],
            query: `trace:${trace.value}`,
          },
        },
      ]);
    }
    return endpoints;
  }

  renderBody() {
    const {event, organization, projects, eventView, location} = this.props;
    const {linkedEvents} = this.state;
    const trace = event.tags.find(tag => tag.key === 'trace');

    const hasLinkedEvents =
      linkedEvents && linkedEvents.data && linkedEvents.data.length >= 1;

    return (
      <React.Fragment>
        <Section>
          <SectionHeading>{t('Linked Trace Events')}</SectionHeading>
          {!hasLinkedEvents ? (
            <StyledCard>{t('No linked events found.')}</StyledCard>
          ) : (
            linkedEvents.data.map((item: DiscoverResult) => {
              const eventSlug = generateEventSlug(item);
              const eventUrl = {
                pathname: generateEventDetailsRoute({
                  eventSlug,
                  orgSlug: organization.slug,
                }),
                query: eventView.generateQueryStringObject(),
              };
              const project = projects.find(p => p.slug === item['project.name']);

              return (
                <StyledCard key={item.id} isCurrent={event.id === item.id}>
                  <StyledLink to={eventUrl} data-test-id="linked-event">
                    <ProjectBadge project={project} avatarSize={14} />
                    <div>{item.title ? item.title : item.transaction}</div>
                  </StyledLink>
                  <StyledDate>
                    <DateTime date={item.timestamp} />
                  </StyledDate>
                </StyledCard>
              );
            })
          )}
        </Section>
        <TraceNavigator
          organization={organization}
          eventView={eventView}
          linkedEvents={linkedEvents}
          location={location}
          trace={(trace && trace.value) || undefined}
        />
      </React.Fragment>
    );
  }
}

type TraceNavigatorProps = {
  linkedEvents: {data: DiscoverResult[]};
  organization: Organization;
  api: Client;
  eventView: EventView;
  location: Location;
  trace?: string;
};

type TraceNavigatorState = {
  transactionEvents: SentryTransactionEvent[];
};

class ___TraceNavigator extends React.Component<
  TraceNavigatorProps,
  TraceNavigatorState
> {
  state: TraceNavigatorState = {
    transactionEvents: [],
  };

  componentDidMount() {
    const {linkedEvents} = this.props;

    if (linkedEvents && linkedEvents.data && linkedEvents.data.length >= 1) {
      linkedEvents.data.forEach((item: DiscoverResult) => {
        const eventSlug = generateEventSlug(item);
        this.fetchEvent(eventSlug).then(response => {
          this.setState(prevState => {
            return {
              transactionEvents: [...prevState.transactionEvents, response],
            };
          });
        });
      });
    }
  }

  fetchEvent(eventSlug: String): Promise<SentryTransactionEvent> {
    const {organization, eventView, api, location} = this.props;

    const url = `/organizations/${organization.slug}/events/${eventSlug}/`;

    return api.requestPromise(url, {
      query: eventView.getEventsAPIPayload(location),
    });
  }

  generateGlobalTransactionEvent(): SentryTransactionEvent {
    const {transactionEvents} = this.state;

    const spans: SpanType[] = transactionEvents.map(
      (event): SpanType => {
        const traceContext = event.contexts.trace;
        const traceID = (traceContext && traceContext.trace_id) || '';
        const rootSpanID = (traceContext && traceContext.span_id) || '';
        const rootSpanOpName = (traceContext && traceContext.op) || 'transaction';
        const parentSpanID = traceContext && traceContext.parent_span_id;

        return {
          trace_id: traceID,
          parent_span_id: parentSpanID,
          span_id: rootSpanID,
          start_timestamp: event.startTimestamp,
          timestamp: event.endTimestamp, // this is essentially end_timestamp
          // same_process_as_parent?: boolean;
          op: rootSpanOpName,
          description: (event as any).title || undefined,
          data: {},
          // tags: (event as any).tags || undefined,
        };
      }
    );

    const startTimestamp = spans.reduce((best, span) => {
      if (best < 0) {
        return span.timestamp;
      }

      if (span.timestamp < best) {
        return span.start_timestamp;
      }
      return best;
    }, -1);

    const endTimestamp = spans.reduce((best, span) => {
      if (span.timestamp > best) {
        return span.start_timestamp;
      }
      return best;
    }, startTimestamp);

    return {
      entries: [
        {
          type: 'spans',
          data: spans,
        },
      ],
      startTimestamp,
      endTimestamp,
      contexts: {
        trace: {
          op: 'trace',
          trace_id: this.props.trace,
        },
      },
    };
  }

  render() {
    if (this.state.transactionEvents.length <= 0) {
      return null;
    }

    const {organization, eventView} = this.props;
    const event = this.generateGlobalTransactionEvent();

    return (
      <Section>
        <Panel>
          <TraceView
            event={event}
            searchQuery={undefined}
            orgId={organization.slug}
            eventView={eventView}
          />
        </Panel>
      </Section>
    );
  }
}

const TraceNavigator = withApi(___TraceNavigator);

const Section = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledCard = styled('div')<{isCurrent?: boolean; theme?: any}>`
  display: flex;
  flex-direction: column;
  background: ${p => p.theme.white};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  border: 1px solid ${p => (p.isCurrent ? p.theme.purpleLight : p.theme.borderLight)};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(1)};
  padding: ${space(1)} ${space(2)};

  @media (min-width: ${theme.breakpoints[3]}) {
    flex-direction: row;
    justify-content: space-between;
  }
`;

const StyledLink = styled(Link)`
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow-wrap: break-word;

  @media (min-width: ${theme.breakpoints[3]}) {
    flex-direction: row;
    flex-grow: 1;
  }
`;

const StyledDate = styled('div')`
  width: 100%;
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};

  @media (min-width: ${theme.breakpoints[3]}) {
    width: auto;
    text-align: right;
    white-space: nowrap;
  }
`;

export default withProjects(LinkedEvents);
