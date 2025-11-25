import type {Location, LocationDescriptor} from 'history';
import moment from 'moment-timezone';

import {isWebVitalsEvent} from 'sentry/components/events/interfaces/performance/utils';
import {getTraceDateTimeRange} from 'sentry/components/events/interfaces/spans/utils';
import {getEventTimestampInSeconds} from 'sentry/components/events/interfaces/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {Event, EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import type {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

function isTransaction(event: Event): event is EventTransaction {
  return event.type === 'transaction';
}

export function getTraceTimeRangeFromEvent(event: Event): {end: string; start: string} {
  const start = isTransaction(event)
    ? event.startTimestamp
    : moment(event.dateReceived ? event.dateReceived : event.dateCreated).valueOf() /
      1000;
  const end = isTransaction(event) ? event.endTimestamp : start;
  return getTraceDateTimeRange({start, end});
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
      timestamp: isWebVitalsEvent(event) ? undefined : getEventTimestampInSeconds(event),
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
    projects: [ALL_ACCESS_PROJECTS],
    version: 2,
    ...dateSelection,
  });
  return eventView.getResultsViewUrlTarget(
    organization,
    false,
    hasDatasetSelector(organization) ? SavedQueryDatasets.ERRORS : undefined
  );
}
