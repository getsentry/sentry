import type {Location, LocationDescriptorObject} from 'history';

import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

import {getTimeStampFromTableDateField} from '../dates';
import {getTransactionDetailsUrl} from '../performance/urls';
import {normalizeUrl} from '../withDomainRequired';

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
  orgSlug,
}: {
  eventSlug: string;
  orgSlug: string;
}): string {
  return normalizeUrl(`/organizations/${orgSlug}/discover/${eventSlug}/`);
}

/**
 * Return a URL to the trace view or the event details view depending on the
 * feature flag.
 *
 * TODO Abdullah Khan: Add link to new trace view doc explaining why we route to the traceview.
 */
export function generateLinkToEventInTraceView({
  organization,
  isHomepage,
  location,
  spanId,
  projectSlug,
  timestamp,
  traceSlug,
  eventId,
  transactionName,
  eventView,
  type = 'performance',
}: {
  eventId: string;
  location: Location;
  organization: Pick<Organization, 'slug' | 'features'>;
  projectSlug: string;
  timestamp: string | number;
  traceSlug: string;
  eventView?: EventView;
  isHomepage?: boolean;
  spanId?: string;
  transactionName?: string;
  type?: 'performance' | 'discover';
}) {
  const _eventView = eventView ?? EventView.fromLocation(location);
  const dateSelection = _eventView.normalizeDateSelection(location);
  const normalizedTimestamp = getTimeStampFromTableDateField(timestamp);
  const eventSlug = generateEventSlug({id: eventId, project: projectSlug});

  if (organization.features.includes('trace-view-v1')) {
    return getTraceDetailsUrl(
      organization,
      String(traceSlug),
      dateSelection,
      normalizedTimestamp,
      eventId,
      spanId
    );
  }

  if (type === 'performance') {
    return getTransactionDetailsUrl(
      organization.slug,
      eventSlug,
      transactionName,
      location.query,
      spanId
    );
  }

  const target: LocationDescriptorObject = {
    pathname: eventDetailsRoute({
      orgSlug: organization.slug,
      eventSlug,
    }),
    query: {..._eventView.generateQueryStringObject(), homepage: isHomepage},
  };

  if (spanId) {
    target.hash = `span-${spanId}`;
  }

  return target;
}

/**
 * Create a URL target to event details with an event view in the query string.
 */
export function eventDetailsRouteWithEventView({
  orgSlug,
  eventSlug,
  eventView,
  isHomepage,
}: {
  eventSlug: string;
  eventView: EventView;
  orgSlug: string;
  isHomepage?: boolean;
}) {
  const pathname = eventDetailsRoute({
    orgSlug,
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
export function getDiscoverLandingUrl(organization: OrganizationSummary): string {
  if (organization.features.includes('discover-query')) {
    return `/organizations/${organization.slug}/discover/homepage/`;
  }
  return `/organizations/${organization.slug}/discover/results/`;
}

export function getDiscoverQueriesUrl(organization: OrganizationSummary): string {
  return `/organizations/${organization.slug}/discover/queries/`;
}
