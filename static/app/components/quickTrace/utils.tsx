import type {Location, LocationDescriptor} from 'history';

import {getEventTimestampInSeconds} from 'sentry/components/events/interfaces/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import type {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

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
