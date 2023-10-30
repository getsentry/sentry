import {Location, LocationDescriptor} from 'history';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {OrganizationSummary} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {
  eventDetailsRouteWithEventView,
  generateEventSlug,
} from 'sentry/utils/discover/urls';
import {
  EventLite,
  QuickTraceEvent,
  TraceError,
  TracePerformanceIssue,
} from 'sentry/utils/performance/quickTrace/types';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

export function isQuickTraceEvent(
  event: QuickTraceEvent | TraceError | TracePerformanceIssue
): event is QuickTraceEvent {
  return defined((event as QuickTraceEvent)['transaction.duration']);
}

export type ErrorDestination = 'discover' | 'issue';

export type TransactionDestination = 'discover' | 'performance';

export function generateIssueEventTarget(
  event: TraceError | TracePerformanceIssue,
  organization: OrganizationSummary,
  referrer?: string
): LocationDescriptor {
  const queryParams = referrer ? '?referrer=' + referrer : '';
  return `/organizations/${organization.slug}/issues/${event.issue_id}/events/${event.event_id}/${queryParams}`;
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
  return getTransactionDetailsUrl(organization.slug, eventSlug, event.transaction, query);
}

function generateDiscoverEventTarget(
  event: EventLite | TraceError | TracePerformanceIssue,
  organization: OrganizationSummary,
  location: Location,
  referrer?: string
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
      ...(referrer ? {referrer} : {}),
    },
  };
  return eventDetailsRouteWithEventView({
    orgSlug: organization.slug,
    eventSlug,
    eventView: EventView.fromLocation(newLocation),
    isHomepage: location.query.homepage === 'true' || undefined,
  });
}

export function generateSingleErrorTarget(
  event: TraceError | TracePerformanceIssue,
  organization: OrganizationSummary,
  location: Location,
  destination: ErrorDestination,
  referrer?: string
): LocationDescriptor {
  switch (destination) {
    case 'issue':
      return generateIssueEventTarget(event, organization, referrer);
    case 'discover':
    default:
      return generateDiscoverEventTarget(event, organization, location, referrer);
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
  const queryResults = new MutableSearch([]);
  const eventIds = events.map(child => child.event_id);
  for (let i = 0; i < eventIds.length; i++) {
    queryResults.addOp(i === 0 ? '(' : 'OR');
    queryResults.addFreeText(`id:${eventIds[i]}`);
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

  const dateSelection = normalizeDateTimeParams(getTraceTimeRangeFromEvent(event));

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
