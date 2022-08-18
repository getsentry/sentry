import {useRef} from 'react';
import {useTheme} from '@emotion/react';
import {YAXisComponentOption} from 'echarts';
import {Location} from 'history';
import moment from 'moment';

import EventsRequest from 'sentry/components/charts/eventsRequest';
import {LineChart, LineChartSeries} from 'sentry/components/charts/lineChart';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import {getInterval} from 'sentry/components/charts/utils';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DateString, EventError, Group, Organization} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {
  findRangeOfMultiSeries,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import useApi from 'sentry/utils/useApi';
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

  const nowRef = useRef<DateString>(new Date());

  // TODO (udameli): Project ID is hardcoded to sentry for the experiment
  // because performance issues from sentry project are sent to a different project
  const PROJECT_ID = 1;

  const issueStart = issue.firstSeen;
  const timeFromFirstSeen = moment(nowRef.current).diff(issueStart);
  const start = moment(issueStart).subtract(timeFromFirstSeen).format();
  const interval = getInterval({start, end: nowRef.current, utc: true}, 'low');

  return (
    <EventsRequest
      api={allEventsApi}
      project={[PROJECT_ID]}
      environment={[]}
      start={start}
      end={nowRef.current}
      query={allEventsQuery}
      organization={organization}
      yAxis={['p75(transaction.duration)']}
      partial
      interval={interval}
      referrer="api.performance.performance-issue-poc.all-events"
      currentSeriesNames={[t('p75(transaction.duration)')]}
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
          end={nowRef.current}
          query={affectedEventsQuery}
          organization={organization}
          yAxis={['p75(transaction.duration)']}
          partial
          interval={interval}
          referrer="api.performance.performance-issue-poc.affected-events"
          currentSeriesNames={[t('p75(transaction.duration)')]}
        >
          {({
            timeseriesData: data,
            loading: affectedEventsLoading,
            errored: affectedEventsErrored,
          }) => (
            <Content
              allEvents={allEvents ?? []}
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

interface ContentProps {
  affectedEvents: LineChartSeries[] | undefined;
  allEvents: Series[] | undefined;
  errored: boolean;
  loading: boolean;
}

function Content({affectedEvents, allEvents, errored, loading}: ContentProps) {
  const theme = useTheme();

  if (!affectedEvents || affectedEvents.length === 0) {
    return null;
  }

  if (loading) {
    return <LoadingPanel />;
  }

  const durationUnit = getDurationUnit(affectedEvents);
  const range = findRangeOfMultiSeries([...affectedEvents, ...(allEvents || [])]);
  let min = 0;
  if (range) {
    min = range.min - (range.max - range.min) * 0.2;
  }

  const yAxis: YAXisComponentOption = {
    show: false,
    minInterval: durationUnit,
    min,
    axisLabel: {
      color: theme.chartLabel,
      formatter() {
        return '';
      },
    },
  };

  return errored ? (
    <ErrorPanel>
      <IconWarning color="gray300" size="lg" />
    </ErrorPanel>
  ) : (
    <LineChart
      grid={{left: '0', right: '0', top: '0', bottom: '0'}}
      height={200}
      series={affectedEvents}
      seriesOptions={{smooth: true}}
      previousPeriod={allEvents}
      xAxis={{type: 'time' as const, axisLine: {onZero: false}}}
      yAxis={yAxis}
      isGroupedByDate
      showTimeInTooltip
      useShortDate
      tooltip={{
        valueFormatter: (value, seriesName) => {
          return tooltipFormatter(
            value,
            aggregateOutputType(
              affectedEvents && affectedEvents.length
                ? affectedEvents[0].seriesName
                : seriesName
            )
          );
        },
      }}
    />
  );
}
