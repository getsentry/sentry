import * as Sentry from '@sentry/react';
import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import {makeDiscoverPathname} from 'sentry/views/discover/pathnames';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import type {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

import type {EventData} from './eventView';
import EventView from './eventView';

/**
 * Create a slug that can be used with discover details views
 * or as a reference event for event-stats requests
 */
export function generateEventSlug(eventData: EventData): string {
  const id = eventData.id || eventData.latest_event;
  const projectSlug = eventData.project || eventData['project.name'];

  return `${projectSlug}:${id}`;
}

/**
 * Create a URL to an event details view.
 */
export function eventDetailsRoute({
  eventSlug,
  organization,
}: {
  eventSlug: string;
  organization: Organization;
}): string {
  return makeDiscoverPathname({
    path: `/${eventSlug}/`,
    organization,
  });
}

/**
 * Return a URL to the trace view or the event details view depending on the
 * feature flag.
 *
 * TODO Abdullah Khan: Add link to new trace view doc explaining why we route to the traceview.
 */
export function generateLinkToEventInTraceView({
  organization,
  location,
  spanId,
  timestamp,
  traceSlug,
  eventId,
  eventView,
  targetId,
  demo,
  source,
  view,
}: {
  location: Location;
  organization: Organization;
  timestamp: string | number;
  traceSlug: string;
  demo?: string;
  eventId?: string;
  eventView?: EventView;
  source?: TraceViewSources;
  spanId?: string;
  // targetId represents the span id of the transaction. It will replace eventId once all links
  // to trace view are updated to use spand ids of transactions instead of event ids.
  targetId?: string;
  view?: DomainView;
}) {
  const _eventView = eventView ?? EventView.fromLocation(location);
  const dateSelection = _eventView.normalizeDateSelection(location);
  const normalizedTimestamp = getTimeStampFromTableDateField(timestamp);

  if (!traceSlug) {
    Sentry.withScope(scope => {
      scope.setExtras({traceSlug, source});
      scope.setLevel('warning' as any);
      Sentry.captureException(new Error('Trace slug is missing'));
    });
  }

  return getTraceDetailsUrl({
    organization,
    traceSlug,
    dateSelection,
    timestamp: normalizedTimestamp,
    eventId,
    targetId,
    spanId,
    demo,
    location,
    source,
    view,
  });
}

/**
 * Create a URL target to event details with an event view in the query string.
 */
export function eventDetailsRouteWithEventView({
  organization,
  eventSlug,
  eventView,
  isHomepage,
}: {
  eventSlug: string;
  eventView: EventView;
  organization: Organization;
  isHomepage?: boolean;
}) {
  const pathname = eventDetailsRoute({
    organization,
    eventSlug,
  });

  return {
    pathname,
    query: {...eventView.generateQueryStringObject(), homepage: isHomepage},
  };
}

/**
 * Get the URL for the discover entry page which changes based on organization
 * feature flags.
 */
export function getDiscoverLandingUrl(organization: Organization): string {
  if (organization.features.includes('discover-query')) {
    return makeDiscoverPathname({
      path: `/homepage/`,
      organization,
    });
  }
  return makeDiscoverPathname({
    path: `/results/`,
    organization,
  });
}

export function getDiscoverQueriesUrl(organization: Organization): string {
  return makeDiscoverPathname({
    path: `/queries/`,
    organization,
  });
}
