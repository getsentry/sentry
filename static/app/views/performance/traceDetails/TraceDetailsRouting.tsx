import {useEffect} from 'react';
import {browserHistory} from 'react-router';
import type {LocationDescriptorObject} from 'history';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {getEventTimestamp} from 'sentry/components/quickTrace/utils';
import type {Event} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {getTraceDetailsUrl} from './utils';

type Props = {
  children: JSX.Element;
  event: Event;
};

function TraceDetailsRouting(props: Props) {
  const {event, children} = props;
  const organization = useOrganization();
  const location = useLocation();
  const datetimeSelection = normalizeDateTimeParams(location.query);

  useEffect(() => {
    const traceId = event.contexts?.trace?.trace_id ?? '';

    if (organization.features.includes('trace-view-v1')) {
      if (event?.groupID && event?.eventID) {
        const issuesLocation = `/organizations/${organization.slug}/issues/${event.groupID}/events/${event.eventID}`;
        browserHistory.replace({
          pathname: issuesLocation,
        });
      } else {
        const traceDetailsLocation: LocationDescriptorObject = getTraceDetailsUrl(
          organization,
          traceId,
          datetimeSelection,
          location.query,
          getEventTimestamp(event),
          event.eventID
        );

        browserHistory.replace({
          pathname: traceDetailsLocation.pathname,
          query: traceDetailsLocation.query,
        });
      }
    }
  }, [event, location, organization, datetimeSelection]);

  return children;
}

export default TraceDetailsRouting;
