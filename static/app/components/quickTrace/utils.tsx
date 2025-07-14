import type {Location, LocationDescriptor} from 'history';

import {getEventTimestampInSeconds} from 'sentry/components/events/interfaces/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {
  eventDetailsRouteWithEventView,
  generateEventSlug,
} from 'sentry/utils/discover/urls';
import type {
  EventLite,
  QuickTraceEvent,
  TraceError,
  TracePerformanceIssue,
} from 'sentry/utils/performance/quickTrace/types';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import type {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

export function isQuickTraceEvent(
  event: QuickTraceEvent | TraceError | TracePerformanceIssue
): event is QuickTraceEvent {
  return defined((event as QuickTraceEvent)['transaction.duration']);
}

export type ErrorDestination = 'discover' | 'issue';

export function generateIssueEventTarget(
  event: TraceError | TracePerformanceIssue | TraceTree.EAPError,
  organization: Organization,
  referrer?: string
): LocationDescriptor {
  const queryParams = referrer ? '?referrer=' + referrer : '';
  return `/organizations/${organization.slug}/issues/${event.issue_id}/events/${event.event_id}/${queryParams}`;
}

function generateDiscoverEventTarget(
  event: EventLite | TraceError | TracePerformanceIssue,
  organization: Organization,
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
    organization,
    eventSlug,
    eventView: EventView.fromLocation(newLocation),
    isHomepage: location.query.homepage === 'true' || undefined,
  });
}

export function generateSingleErrorTarget(
  event: TraceError | TracePerformanceIssue,
  organization: Organization,
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

export function generateTraceTarget(
  event: Event,
  organization: Organization,
  location: Location,
  source?: TraceViewSources
): LocationDescriptor {
  const traceId = event.contexts?.trace?.trace_id ?? '';

  const dateSelection = normalizeDateTimeParams(getTraceTimeRangeFromEvent(event));

  if (organization.features.includes('performance-view')) {
    // TODO(txiao): Should this persist the current query when going to trace view?
    return getTraceDetailsUrl({
      organization,
      traceSlug: traceId,
      dateSelection,
      timestamp: getEventTimestampInSeconds(event),
      eventId: event.eventID,
      location,
      source,
    });
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
  return eventView.getResultsViewUrlTarget(
    organization,
    false,
    hasDatasetSelector(organization) ? SavedQueryDatasets.ERRORS : undefined
  );
}
