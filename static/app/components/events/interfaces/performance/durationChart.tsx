import {useState} from 'react';
import {Location} from 'history';
import moment from 'moment';

import EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import {DateString, Group, Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import Chart from 'sentry/views/performance/charts/chart';

import {affectedEvents, allEventsData} from './fakeData';

interface Props {
  event: any;
  issue: Group;
  location: Location;
  organization: Organization;
}

export function DurationChart({issue, event, organization}: Props) {
  // const transactionName = event.culprit;
  const transactionName = '/api/0/organizations/{organization_slug}/events/';
  const allEventsQuery = `event.type:transaction transaction:${transactionName}`;
  const affectedEventsQuery = `${allEventsQuery} has_performance_issue:True`;
  const api = useApi();
  const api1 = useApi();
  const [now] = useState<DateString>(new Date());

  // const diff = moment(now).diff(issue.firstSeen);
  // const start = moment(issue.firstSeen).subtract(diff).format();
  const start = new Date('2022-07-09T07:14:35').toString();
  const end = new Date('2022-07-12T12:57:44').toString();
  const end1 = new Date('2022-07-12T12:57:40');
  const interval = '30m';
  const issueStart = new Date('2022-07-11T13:41:21').toString();

  return (
    <EventsRequest
      api={api}
      project={[1]}
      environment={[]}
      start={start}
      end={end}
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
          start={issueStart}
          end={end}
          query={affectedEventsQuery}
          organization={organization}
          yAxis={['p75(transaction.duration)']}
          partial
          interval={interval}
          referrer="api.performance.performance-issue-poc.affected-events"
          currentSeriesNames={['Affected Events']}
        >
          {({timeseriesData: data}) => (
            <Content
              start={start}
              end={now}
              allEvents={allEvents}
              affectedEvents={data}
            />
          )}
        </EventsRequest>
      )}
    </EventsRequest>
  );
}

function Content({allEvents, affectedEvents: _affectedEvents, start, end}) {
  return (
    <Chart
      grid={{left: '0', right: '0', top: '0', bottom: '0px'}}
      router={{}}
      loading={false}
      statsPeriod=""
      utc
      isLineChart
      data={affectedEvents}
      previousData={allEventsData}
      start={start}
      end={end}
      disableMultiAxis
      height={200}
    />
  );
}
