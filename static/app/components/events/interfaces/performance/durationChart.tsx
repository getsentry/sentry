import {useState} from 'react';
import {Location} from 'history';
import moment from 'moment';

import EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import {IconWarning} from 'sentry/icons';
import {DateString, EventError, Group, Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import Chart from 'sentry/views/performance/charts/chart';
import {ErrorPanel} from 'sentry/views/performance/styles';

interface Props {
  event: EventError;
  issue: Group;
  location: Location;
  organization: Organization;
}

export function DurationChart({issue, event, organization}: Props) {
  const transactionNameTag = event.tags.find(tag => tag.key === 'transaction');
  const transactionName = transactionNameTag ? transactionNameTag.value : '';

  const spanHashTag = event.tags.find(
    tag => tag.key === 'performance_issue.extra_spans'
  ) || {key: '', value: ''};

  const allEventsQuery = `event.type:transaction transaction:${transactionName}`;
  const affectedEventsQuery = `${allEventsQuery} ${spanHashTag.key}:${spanHashTag.value}`;

  const allEventsApi = useApi();
  const affectedEventsApi = useApi();

  // TODO find a better way to grab current time
  const [now] = useState<DateString>(new Date());

  // TODO (udameli): Project ID is hardcoded to sentry for the experiment
  // because performance issues from sentry project are sent to a different project
  const PROJECT_ID = 1;

  const diff = moment(now).diff(issue.firstSeen);
  const start = moment(issue.firstSeen).subtract(diff).format();
  const interval = getInterval({start, end: now, utc: true});
  const issueStart = issue.firstSeen;

  return (
    <EventsRequest
      api={allEventsApi}
      project={[PROJECT_ID]}
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
      {({
        timeseriesData: allEvents,
        loading: allEventsLoading,
        errored: allEventsErrored,
      }) => (
        <EventsRequest
          api={affectedEventsApi}
          project={[PROJECT_ID]}
          environment={[]}
          start={issueStart}
          end={now}
          query={affectedEventsQuery}
          organization={organization}
          yAxis={['p75(transaction.duration)']}
          partial
          interval={interval}
          referrer="api.performance.performance-issue-poc.affected-events"
          currentSeriesNames={['Affected Events']}
        >
          {({
            timeseriesData: data,
            loading: affectedEventsLoading,
            errored: affectedEventsErrored,
          }) => (
            <Content
              start={start}
              end={now}
              allEvents={allEvents}
              affectedEvents={data}
              loading={allEventsLoading || affectedEventsLoading}
              errored={allEventsErrored || affectedEventsErrored}
            />
          )}
        </EventsRequest>
      )}
    </EventsRequest>
  );
}

function Content({allEvents, affectedEvents, start, end, loading, errored}) {
  return errored ? (
    <ErrorPanel>
      <IconWarning color="gray300" size="lg" />
    </ErrorPanel>
  ) : (
    <Chart
      grid={{left: '0', right: '0', top: '0', bottom: '0px'}}
      router={{}}
      loading={loading}
      statsPeriod=""
      utc
      isLineChart
      data={affectedEvents}
      previousData={allEvents}
      start={start}
      end={end}
      disableMultiAxis
      height={200}
    />
  );
}
