import moment from 'moment-timezone';

import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {getUtcDateString} from 'sentry/utils/dates';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';
import {getEventEnvironment} from 'sentry/views/issueDetails/utils';

export function useEventLogsUrl(event: Event, project: Project) {
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
  const environment = getEventEnvironment(event);

  return getLogsUrl({
    organization,
    selection: {
      projects: [parseInt(project.id, 10)],
      environments: environment ? [environment] : [],
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
