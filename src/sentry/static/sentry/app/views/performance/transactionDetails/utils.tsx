import {Location, LocationDescriptor} from 'history';

import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {OrganizationSummary} from 'app/types';
import {Event} from 'app/types/event';
import EventView from 'app/utils/discover/eventView';
import {generateEventSlug} from 'app/utils/discover/urls';
import {EventLite, TraceError} from 'app/utils/performance/quickTrace/types';
import {getTraceTimeRangeFromEvent} from 'app/utils/performance/quickTrace/utils';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';

import {getTraceDetailsUrl} from '../traceDetails/utils';
import {getTransactionDetailsUrl} from '../utils';

export function generateSingleEventTarget(
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

export function generateMultiEventsTarget(
  currentEvent: Event,
  events: EventLite[],
  organization: OrganizationSummary,
  location: Location,
  groupType: 'Ancestor' | 'Children' | 'Descendant'
): LocationDescriptor {
  if (events.length === 1) {
    return generateSingleEventTarget(events[0], organization, location);
  }

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

  const {start, end} = getTraceTimeRangeFromEvent(event);

  if (organization.features.includes('trace-view-summary')) {
    return getTraceDetailsUrl(organization, traceId, start, end, {});
  }

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
