import {useEffect} from 'react';

import DetailedError from 'sentry/components/errors/detailedError';
import NotFound from 'sentry/components/errors/notFound';
import {getEventTimestampInSeconds} from 'sentry/components/events/interfaces/utils';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

/**
 * This component redirects to the Event Details page given only an event ID
 * (which normally additionally requires the event's Issue/Group ID).
 *
 * It fetches the event data from the API to extract the group ID, then navigates
 * to the appropriate issue event page. For events without a group ID (e.g.,
 * transaction events), it falls back to the trace details page.
 *
 * This component handles routes:
 * - /projects/:projectId/events/:eventId/
 * - /:orgId/:projectId/events/:eventId/ (legacy)
 */
export default function ProjectEventRedirect() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{eventId: string; projectId: string}>();
  const datetimeSelection = normalizeDateTimeParams(location.query);

  // Construct the eventSlug in the format expected by the events API: "projectSlug:eventId"
  const eventSlug = `${params.projectId}:${params.eventId}`;

  const {
    data: event,
    isPending,
    error,
  } = useApiQuery<Event>(
    [`/organizations/${organization.slug}/events/${eventSlug}/`],
    {staleTime: 2 * 60 * 1000} // 2 minutes in milliseconds
  );

  useEffect(() => {
    if (!event) {
      return;
    }

    // If the event has a group ID, navigate to the issue event page
    if (event.groupID && event.eventID) {
      navigate(
        {
          pathname: `/organizations/${organization.slug}/issues/${event.groupID}/events/${event.eventID}/`,
          query: location.query,
        },
        {replace: true}
      );
      return;
    }

    // For events without a group ID (e.g., transaction events), try to navigate to trace details
    const traceId = event.contexts?.trace?.trace_id;
    if (traceId) {
      const timestamp = getEventTimestampInSeconds(event);
      navigate(
        getTraceDetailsUrl({
          organization,
          traceSlug: traceId,
          dateSelection: datetimeSelection,
          timestamp,
          eventId: event.eventID,
          location,
        }),
        {replace: true}
      );
    }
  }, [event, organization, datetimeSelection, location, navigate]);

  if (error) {
    const notFound = error.status === 404;
    const permissionDenied = error.status === 403;

    if (notFound) {
      return <NotFound />;
    }

    if (permissionDenied) {
      return (
        <LoadingError message={t('You do not have permission to view that event.')} />
      );
    }

    return (
      <DetailedError
        heading={t('Error')}
        message={error.message || t('Could not load the requested event')}
        hideSupportLinks
      />
    );
  }

  if (
    isPending ||
    (!isPending && event) // Prevents flash of loading error below once event is loaded successfully
  ) {
    return (
      <Layout.Page withPadding>
        <LoadingIndicator />
      </Layout.Page>
    );
  }

  // This is only reachable if the event hasn't loaded for an unknown reason or
  // we haven't been able to re-route to the correct page
  return <LoadingError message={t('Failed to load the details for the event')} />;
}
