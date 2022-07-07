import {useState} from 'react';
import {Location} from 'history';
import moment from 'moment';

import EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import {DateString, Group, Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import Chart from 'sentry/views/performance/charts/chart';

interface Props {
  event: any;
  issue: Group;
  location: Location;
  organization: Organization;
}

export function DurationChart({issue, event, organization}: Props) {
  const transactionName = event.culprit;
  const allEventsQuery = `event.type:transaction transaction:${transactionName}`;
  const affectedEventsQuery = `${allEventsQuery} has_performance_issue:True`;
  const api = useApi();
  const api1 = useApi();
  const [now] = useState<DateString>(new Date());

  const diff = moment(now).diff(issue.firstSeen);
  const start = moment(issue.firstSeen).subtract(diff).format();
  const interval = getInterval({start, end: now});

  return (
    <EventsRequest
      api={api}
      project={[1]}
      environment={[]}
      start={start}
      end={now}
      query={allEventsQuery}
      organization={organization}
      yAxis={['p75(transaction.duration)']}
      partial
      interval={interval}
      referrer="api.performance.performance-issue-poc.all-events"
      currentSeriesNames={['All Events']}
    >
      {({timeseriesData: allEvents}) => (
        <EventsRequest
          api={api1}
          project={[1]}
          environment={[]}
          start={issue.firstSeen}
          end={now}
          query={affectedEventsQuery}
          organization={organization}
          yAxis={['p75(transaction.duration)']}
          partial
          interval={interval}
          referrer="api.performance.performance-issue-poc.affected-events"
          currentSeriesNames={['Affected Events']}
        >
          {({timeseriesData: affectedEvents}) => (
            <Content
              start={start}
              end={now}
              allEvents={allEvents}
              affectedEvents={affectedEvents}
            />
          )}
        </EventsRequest>
      )}
    </EventsRequest>
  );
}

function Content({allEvents, affectedEvents, start, end}) {
  return (
    <Chart
      router={{}}
      loading={false}
      statsPeriod=""
      utc
      isLineChart
      data={affectedEvents}
      previousData={allEvents}
      start={start}
      end={end}
    />
  );
}
