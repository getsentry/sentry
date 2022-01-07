import EventsRequest from 'sentry/components/charts/eventsRequest';
import {DISCOVER_FIELD_TO_METRIC} from 'sentry/utils/metrics/fields';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {decodeList} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useMetricsSwitch} from 'sentry/views/performance/metricsSwitch';

function EventsOrMetricsRequest(props: any) {
  const {isMetricsData} = useMetricsSwitch(); // TODO(metrics): decision logic will be dynamic in the future, not switch toggle
  const api = useApi();

  if (isMetricsData) {
    return (
      <MetricsRequest
        api={api}
        organization={props.organization}
        start={props.start}
        end={props.end}
        statsPeriod={props.period}
        project={props.project}
        environment={props.environment}
        query={props.query}
        field={decodeList(props.yAxis).map(yAxis => DISCOVER_FIELD_TO_METRIC[yAxis])}
        groupBy={undefined} // TODO(metrics): some of the fields of events request will need to become groupBys
        includePrevious
        includeTransformedData
        currentSeriesNames={props.currentSeriesNames}
        previousSeriesNames={props.previousSeriesNames}
      >
        {props.children}
      </MetricsRequest>
    );
  }

  return <EventsRequest {...props} api={api} />;
}

export default EventsOrMetricsRequest;
