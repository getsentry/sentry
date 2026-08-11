import moment from 'moment-timezone';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import type {Event} from 'sentry/types/event';
import {getUtcDateString} from 'sentry/utils/dates';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';

export function useEventLogsUrl(event: Event) {
  const organization = useOrganization();
  const traceId = event.contexts.trace?.trace_id;
  if (!traceId) {
    return null;
  }

  const eventTimestamp = event.dateCreated || event.dateReceived;
  if (!eventTimestamp) {
    return null;
  }

  const eventMoment = moment(eventTimestamp);
  const start = getUtcDateString(eventMoment.clone().subtract(1, 'day'));
  const end = getUtcDateString(eventMoment.clone().add(1, 'day'));

  return getLogsUrl({
    organization,
    selection: {
      projects: [ALL_ACCESS_PROJECTS],
      environments: [],
      datetime: {
        start,
        end,
        period: null,
        utc: null,
      },
    },
    query: `${OurLogKnownFieldKey.TRACE_ID}:${traceId}`,
  });
}
