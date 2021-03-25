import {Location, LocationDescriptor} from 'history';

import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {OrganizationSummary} from 'app/types';
import {Event} from 'app/types/event';
import EventView from 'app/utils/discover/eventView';
import {eventDetailsRoute, generateEventSlug} from 'app/utils/discover/urls';
import {EventLite, TraceError} from 'app/utils/performance/quickTrace/types';
import {getTraceTimeRangeFromEvent} from 'app/utils/performance/quickTrace/utils';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import {getTraceDetailsUrl} from 'app/views/performance/traceDetails/utils';
import {getTransactionDetailsUrl} from 'app/views/performance/utils';

export type ErrorDestination = 'discover' | 'performance' | 'issue';

export type TransactionDestination = 'discover' | 'performance';

function generateIssueEventTarget(
  event: EventLite | TraceError,
  organization: OrganizationSummary
): LocationDescriptor {
  // TODO(txiao): This requires the group permalink, linking to discover for now.
  return generateDiscoverEventTarget(event, organization);
}

function generatePerformanceEventTarget(
  event: EventLite | TraceError,
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

function generateDiscoverEventTarget(
  event: EventLite | TraceError,
  organization: OrganizationSummary
): LocationDescriptor {
  const eventSlug = generateEventSlug({
    id: event.event_id,
    project: event.project_slug,
  });
  return {
    pathname: eventDetailsRoute({
      orgSlug: organization.slug,
      eventSlug,
    }),
    query: {},
  };
}

export function generateSingleErrorTarget(
  event: EventLite | TraceError,
  organization: OrganizationSummary,
  location: Location,
  destination: ErrorDestination
): LocationDescriptor {
  switch (destination) {
    case 'issue':
      return generateIssueEventTarget(event, organization);
    case 'performance':
      return generatePerformanceEventTarget(event, organization, location);
    case 'discover':
    default:
      return generateDiscoverEventTarget(event, organization);
  }
}

export function generateSingleTransactionTarget(
  event: EventLite | TraceError,
  organization: OrganizationSummary,
  location: Location,
  destination: TransactionDestination
): LocationDescriptor {
  switch (destination) {
    case 'performance':
      return generatePerformanceEventTarget(event, organization, location);
    case 'discover':
    default:
      return generateDiscoverEventTarget(event, organization);
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
    query: stringifyQueryObject(queryResults),
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

  if (organization.features.includes('trace-view-summary')) {
    return getTraceDetailsUrl(organization, traceId, dateSelection, {});
  }

  const eventView = EventView.fromSavedQuery({
    id: undefined,
    name: `Transactions with Trace ID ${traceId}`,
    fields: ['transaction', 'project', 'trace.span', 'transaction.duration', 'timestamp'],
    orderby: '-timestamp',
    query: `event.type:transaction trace:${traceId}`,
    projects: [ALL_ACCESS_PROJECTS],
    version: 2,
    ...dateSelection,
  });
  return eventView.getResultsViewUrlTarget(organization.slug);
}
