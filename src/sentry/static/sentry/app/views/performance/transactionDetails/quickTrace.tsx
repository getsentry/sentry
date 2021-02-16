import React from 'react';
import {Location, LocationDescriptor} from 'history';

import {getTraceDateTimeRange} from 'app/components/events/interfaces/spans/utils';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import Tooltip from 'app/components/tooltip';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {t, tn} from 'app/locale';
import {OrganizationSummary, Project} from 'app/types';
import {Event, EventTransaction} from 'app/types/event';
import EventView from 'app/utils/discover/eventView';
import {generateEventSlug} from 'app/utils/discover/urls';
import {getShortEventId} from 'app/utils/events';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import withProjects from 'app/utils/withProjects';

import {getTransactionDetailsUrl} from '../utils';

import QuickTraceQuery, {EventLite, TraceLite} from './quickTraceQuery';
import {Dash, EventNode, MetaData} from './styles';
import {isTransaction, parseTraceLite} from './utils';

type Props = {
  event: Event;
  location: Location;
  organization: OrganizationSummary;
};

export default function QuickTrace({event, location, organization}: Props) {
  // non transaction events are currently unsupported
  if (!isTransaction(event)) {
    return null;
  }

  const traceId = event.contexts?.trace?.trace_id ?? null;
  const traceTarget = generateTraceTarget(event, organization);

  return (
    <QuickTraceQuery event={event} location={location} orgSlug={organization.slug}>
      {({isLoading, error, trace}) => {
        const body = isLoading ? (
          <Placeholder height="33px" />
        ) : error || trace === null ? (
          '\u2014'
        ) : (
          <QuickTraceLite
            event={event}
            trace={trace}
            location={location}
            organization={organization}
          />
        );

        return (
          <MetaData
            headingText={t('Quick Trace')}
            tooltipText={t('A minified version of the full trace.')}
            bodyText={body}
            subtext={
              traceId === null ? (
                '\u2014'
              ) : (
                <Link to={traceTarget}>
                  {t('Trace ID: %s', getShortEventId(traceId))}
                </Link>
              )
            }
          />
        );
      }}
    </QuickTraceQuery>
  );
}

type QuickTraceLiteProps = {
  event: Event;
  trace: TraceLite;
  location: Location;
  organization: OrganizationSummary;
  projects: Project[];
};

const QuickTraceLite = withProjects(
  ({event, trace, location, organization, projects}: QuickTraceLiteProps) => {
    // non transaction events are currently unsupported
    if (!isTransaction(event)) {
      return null;
    }

    const {root, current, children} = parseTraceLite(trace, event);
    const nodes: React.ReactNode[] = [];

    if (root) {
      const target = generateSingleEventTarget(root, organization, projects, location);
      nodes.push(
        <Tooltip position="top" title={t('View the root transaction in this trace.')}>
          <EventNode key="root" type="white" pad="right" icon={null} to={target}>
            {t('Root')}
          </EventNode>
        </Tooltip>
      );
      nodes.push(<Dash />);
    }

    const traceTarget = generateTraceTarget(event, organization);

    if (root && current && root.event_id !== current.parent_event_id) {
      nodes.push(
        <Tooltip position="top" title={t('View all transactions in this trace.')}>
          <EventNode
            key="ancestors"
            type="white"
            pad="right"
            icon={null}
            to={traceTarget}
          >
            {t('Ancestors')}
          </EventNode>
        </Tooltip>
      );
      nodes.push(<Dash />);
    }

    nodes.push(
      <EventNode key="current" type="black">
        {t('This Event')}
      </EventNode>
    );

    if (children.length) {
      const childrenTarget = generateChildrenEventTarget(
        event,
        children,
        organization,
        projects,
        location
      );
      nodes.push(<Dash />);
      nodes.push(
        <Tooltip
          position="top"
          title={tn(
            'View the child transaction of this event.',
            'View all child transactions of this event.',
            children.length
          )}
        >
          <EventNode
            key="children"
            type="white"
            pad="left"
            icon={null}
            to={childrenTarget}
          >
            {tn('%s Child', '%s Children', children.length)}
          </EventNode>
        </Tooltip>
      );

      nodes.push(<Dash />);
      nodes.push(
        <Tooltip position="top" title={t('View all transactions in this trace.')}>
          <EventNode
            key="descendents"
            type="white"
            pad="left"
            icon={null}
            to={traceTarget}
          >
            &nbsp;&nbsp;.&nbsp;&nbsp;.&nbsp;&nbsp;.&nbsp;&nbsp;
          </EventNode>
        </Tooltip>
      );
    }

    return <div>{nodes}</div>;
  }
);

function generateSingleEventTarget(
  event: EventLite,
  organization: OrganizationSummary,
  projects: Project[],
  location: Location
): LocationDescriptor | undefined {
  const project = projects.find(p => parseInt(p.id, 10) === event.project_id);
  if (project === undefined) {
    return undefined;
  }

  const eventSlug = generateEventSlug({
    id: event.event_id,
    project: project.slug,
  });
  return getTransactionDetailsUrl(
    organization,
    eventSlug,
    event.transaction,
    location.query
  );
}

function generateChildrenEventTarget(
  event: EventTransaction,
  children: EventLite[],
  organization: OrganizationSummary,
  projects: Project[],
  location: Location
): LocationDescriptor | undefined {
  if (children.length === 1) {
    return generateSingleEventTarget(children[0], organization, projects, location);
  }

  const queryResults = new QueryResults([]);
  const eventIds = children.map(child => child.event_id);
  for (let i = 0; i < eventIds.length; i++) {
    queryResults.addOp(i === 0 ? '(' : 'OR');
    queryResults.addQuery(`id:${eventIds[i]}`);
    if (i === eventIds.length - 1) {
      queryResults.addOp(')');
    }
  }

  const {start, end} = getTraceDateTimeRange({
    start: event.startTimestamp,
    end: event.endTimestamp,
  });
  const traceEventView = EventView.fromSavedQuery({
    id: undefined,
    name: `Child Transactions of Event ID ${event.id}`,
    fields: ['transaction', 'project', 'trace.span', 'transaction.duration', 'timestamp'],
    orderby: '-timestamp',
    query: stringifyQueryObject(queryResults),
    projects: [...new Set(children.map(child => child.project_id))],
    version: 2,
    start,
    end,
  });
  return traceEventView.getResultsViewUrlTarget(organization.slug);
}

function generateTraceTarget(
  event: EventTransaction,
  organization: OrganizationSummary
): LocationDescriptor {
  const traceId = event.contexts?.trace?.trace_id ?? '';
  const {start, end} = getTraceDateTimeRange({
    start: event.startTimestamp,
    end: event.endTimestamp,
  });
  const eventView = EventView.fromSavedQuery({
    id: undefined,
    name: `Transactions with Trace ID ${traceId}`,
    fields: ['transaction', 'project', 'trace.span', 'transaction.duration', 'timestamp'],
    orderby: '-timestamp',
    query: `event.type:transaction trace:${traceId}`,
    projects: [ALL_ACCESS_PROJECTS],
    version: 2,
    start,
    end,
  });
  return eventView.getResultsViewUrlTarget(organization.slug);
}
