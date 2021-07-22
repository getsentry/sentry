import {Location, LocationDescriptor} from 'history';

import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {OrganizationSummary} from 'app/types';
import {Event} from 'app/types/event';
import {defined} from 'app/utils';
import EventView from 'app/utils/discover/eventView';
import {eventDetailsRouteWithEventView, generateEventSlug} from 'app/utils/discover/urls';
import {
  EventLite,
  QuickTraceEvent,
  TraceError,
} from 'app/utils/performance/quickTrace/types';
import {getTraceTimeRangeFromEvent} from 'app/utils/performance/quickTrace/utils';
import {QueryResults} from 'app/utils/tokenizeSearch';
import {getTraceDetailsUrl} from 'app/views/performance/traceDetails/utils';
import {getTransactionDetailsUrl} from 'app/views/performance/utils';

export function isQuickTraceEvent(
  event: QuickTraceEvent | TraceError
): event is QuickTraceEvent {
  return defined((event as QuickTraceEvent)['transaction.duration']);
}

export type ErrorDestination = 'discover' | 'issue';

export type TransactionDestination = 'discover' | 'performance';

export function generateIssueEventTarget(
  event: TraceError,
  organization: OrganizationSummary
): LocationDescriptor {
  return `/organizations/${organization.slug}/issues/${event.issue_id}/events/${event.event_id}`;
}

function generatePerformanceEventTarget(
  event: EventLite,
  organization: OrganizationSummary,
  location: Location
): LocationDescriptor {
  const eventSlug = generateEventSlug({
    id: event.event_id,
    project: event.project_slug,
  });
  const query = {
    ...location.query,
    project: String(event.project_id),
  };
  return getTransactionDetailsUrl(organization, eventSlug, event.transaction, query);
}

function generateDiscoverEventTarget(
  event: EventLite | TraceError,
  organization: OrganizationSummary,
  location: Location
): LocationDescriptor {
  const eventSlug = generateEventSlug({
    id: event.event_id,
    project: event.project_slug,
  });
  const newLocation = {
    ...location,
    query: {
      ...location.query,
      project: String(event.project_id),
    },
  };
  return eventDetailsRouteWithEventView({
    orgSlug: organization.slug,
    eventSlug,
    eventView: EventView.fromLocation(newLocation),
  });
}

export function generateSingleErrorTarget(
  event: TraceError,
  organization: OrganizationSummary,
  location: Location,
  destination: ErrorDestination
): LocationDescriptor {
  switch (destination) {
    case 'issue':
      return generateIssueEventTarget(event, organization);
    case 'discover':
    default:
      return generateDiscoverEventTarget(event, organization, location);
  }
}

export function generateSingleTransactionTarget(
  event: EventLite,
  organization: OrganizationSummary,
  location: Location,
  destination: TransactionDestination
): LocationDescriptor {
  switch (destination) {
    case 'performance':
      return generatePerformanceEventTarget(event, organization, location);
    case 'discover':
    default:
      return generateDiscoverEventTarget(event, organization, location);
  }
}

export function generateMultiTransactionsTarget(
  currentEvent: Event,
  events: EventLite[],
  organization: OrganizationSummary,
  groupType: 'Ancestor' | 'Children' | 'Descendant'
): LocationDescriptor {
  const queryResults = new QueryResults([]);
  const eventIds = events.map(child => child.event_id);
  for (let i = 0; i < eventIds.length; i++) {
    queryResults.addOp(i === 0 ? '(' : 'OR');
    queryResults.addQuery(`id:${eventIds[i]}`);
    if (i === eventIds.length - 1) {
      queryResults.addOp(')');
    }
  }

  const {start, end} = getTraceTimeRangeFromEvent(currentEvent);
  const traceEventView = EventView.fromSavedQuery({
    id: undefined,
    name: `${groupType} Transactions of Event ID ${currentEvent.id}`,
    fields: ['transaction', 'project', 'trace.span', 'transaction.duration', 'timestamp'],
    orderby: '-timestamp',
    query: queryResults.formatString(),
    projects: [...new Set(events.map(child => child.project_id))],
    version: 2,
    start,
    end,
  });
  return traceEventView.getResultsViewUrlTarget(organization.slug);
}

export function generateTraceTarget(
  event: Event,
  organization: OrganizationSummary
): LocationDescriptor {
  const traceId = event.contexts?.trace?.trace_id ?? '';

  const dateSelection = getParams(getTraceTimeRangeFromEvent(event));

  if (organization.features.includes('performance-view')) {
    // TODO(txiao): Should this persist the current query when going to trace view?
    return getTraceDetailsUrl(organization, traceId, dateSelection, {});
  }

  const eventView = EventView.fromSavedQuery({
    id: undefined,
    name: `Events with Trace ID ${traceId}`,
    fields: ['title', 'event.type', 'project', 'trace.span', 'timestamp'],
    orderby: '-timestamp',
    query: `trace:${traceId}`,
    projects: organization.features.includes('global-views')
      ? [ALL_ACCESS_PROJECTS]
      : [Number(event.projectID)],
    version: 2,
    ...dateSelection,
  });
  return eventView.getResultsViewUrlTarget(organization.slug);
}
