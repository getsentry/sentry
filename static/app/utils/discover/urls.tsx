import {OrganizationSummary} from 'sentry/types';

import EventView, {EventData} from './eventView';

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
  return `/organizations/${orgSlug}/discover/${eventSlug}/`;
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
