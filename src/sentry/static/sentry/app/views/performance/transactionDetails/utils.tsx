import {Location, LocationDescriptor} from 'history';

import {getTraceDateTimeRange} from 'app/components/events/interfaces/spans/utils';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {OrganizationSummary} from 'app/types';
import {Event, EventTransaction} from 'app/types/event';
import EventView from 'app/utils/discover/eventView';
import {generateEventSlug} from 'app/utils/discover/urls';
import {EventLite, TraceLite} from 'app/utils/performance/quickTrace/quickTraceQuery';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';

import {getTransactionDetailsUrl} from '../utils';

export function parseTraceLite(trace: TraceLite, event: Event) {
  const root = trace.find(e => e.is_root && e.event_id !== event.id) ?? null;
  const current = trace.find(e => e.event_id === event.id) ?? null;
  const children = trace.filter(e => e.parent_event_id === event.id);
  return {
    root,
    current,
    children,
  };
}

export function generateSingleEventTarget(
  event: EventLite,
  organization: OrganizationSummary,
  location: Location
): LocationDescriptor {
  const eventSlug = generateEventSlug({
    id: event.event_id,
    project: event.project_slug,
  });
  return getTransactionDetailsUrl(
    organization,
    eventSlug,
    event.transaction,
    location.query
  );
}

export function generateChildrenEventTarget(
  event: EventTransaction,
  children: EventLite[],
  organization: OrganizationSummary,
  location: Location
): LocationDescriptor {
  if (children.length === 1) {
    return generateSingleEventTarget(children[0], organization, location);
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

export function generateTraceTarget(
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
