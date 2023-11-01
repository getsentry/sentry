import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {Tooltip} from 'sentry/components/tooltip';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Event, EventsStatsData} from 'sentry/types';
import EventView, {MetaType} from 'sentry/utils/discover/eventView';
import {
  DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DisplayModes,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';
import {transformEventStats} from 'sentry/views/performance/trends/chart';
import {
  NormalizedTrendsTransaction,
  TrendFunctionField,
} from 'sentry/views/performance/trends/types';
import {generateTrendFunctionAsString} from 'sentry/views/performance/trends/utils';

import {DataSection} from '../styles';

import Chart from './lineChart';

function camelToUnderscore(key: string) {
  return key.replace(/([A-Z\d])/g, '_$1').toLowerCase();
}

type EventBreakpointChartProps = {
  event: Event;
};

function EventBreakpointChart({event}: EventBreakpointChartProps) {
  const now = useRef(new Date());
  const organization = useOrganization();
  const location = useLocation();

  const {transaction, breakpoint} = event?.occurrence?.evidenceData ?? {};

  const eventView = EventView.fromLocation(location);
  eventView.query = `event.type:transaction transaction:"${transaction}"`;
  eventView.dataset = DiscoverDatasets.METRICS;

  const {start: beforeDateTime, end: afterDateTime} = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: 14,
  });

  eventView.start = (beforeDateTime as Date).toISOString();
  eventView.end = (afterDateTime as Date).toISOString();
  eventView.statsPeriod = undefined;

  // The evidence data keys are returned to us in camelCase, but we need to
  // convert them to snake_case to match the NormalizedTrendsTransaction type
  const normalizedOccurrenceEvent = Object.keys(
    event?.occurrence?.evidenceData ?? []
  ).reduce((acc, key) => {
    acc[camelToUnderscore(key)] = event?.occurrence?.evidenceData?.[key];
    return acc;
  }, {}) as NormalizedTrendsTransaction;

  const {data, isLoading} = useGenericDiscoverQuery<
    {
      data: EventsStatsData;
      meta: MetaType;
    },
    DiscoverQueryProps
  >({
    route: 'events-stats',
    location,
    eventView,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      // Manually inject y-axis for events-stats because
      // getEventsAPIPayload doesn't pass it along
      ...eventView.getEventsAPIPayload(location),
      yAxis: ['p95(transaction.duration)', 'count()'],
    }),
  });

  const transactionSummaryLink = transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    transaction,
    query: {},
    trendFunction: TrendFunctionField.P95,
    projectID: event.projectID,
    display: DisplayModes.TREND,
  });

  const p95Series = useMemo(
    () =>
      transformEventStats(
        data?.['p95(transaction.duration)']?.data ?? [],
        generateTrendFunctionAsString(TrendFunctionField.P95, 'transaction.duration')
      ),
    [data]
  );

  const throughputSeries = useMemo(() => {
    const bucketSize = 12 * 60 * 60;

    const bucketedData = (data?.['count()']?.data ?? []).reduce((acc, curr) => {
      const timestamp = curr[0];
      const bucket = Math.floor(timestamp / bucketSize) * bucketSize;
      const prev = acc[acc.length - 1];
      const value = curr[1][0].count;

      if (prev?.bucket === bucket) {
        prev.value += value;
        prev.end = timestamp;
        prev.count += 1;
      } else {
        acc.push({bucket, value, start: timestamp, end: timestamp, count: 1});
      }

      return acc;
    }, []);

    return transformEventStats(
      bucketedData.map(item => [
        item.bucket,
        [
          {
            count:
              item.value / (((item.end - item.start) / (item.count - 1)) * item.count),
          },
        ],
      ]),
      'throughput()'
    )[0];
  }, [data]);

  return (
    <DataSection>
      <TransitionChart loading={isLoading} reloading>
        <TransparentLoadingMask visible={isLoading} />
        <Fragment>
          {afterDateTime && now.current > afterDateTime && (
            <SummaryButtonWrapper>
              <Tooltip
                title={t(
                  'The current date is over 14 days from the breakpoint. Open the Transaction Summary to see the most up to date transaction behaviour.'
                )}
              >
                <LinkButton
                  to={transactionSummaryLink}
                  size="xs"
                  icon={<IconOpen size="xs" />}
                >
                  {t('Go to Transaction Summary')}
                </LinkButton>
              </Tooltip>
            </SummaryButtonWrapper>
          )}
          <Chart
            percentileSeries={p95Series}
            throughputSeries={throughputSeries}
            evidenceData={normalizedOccurrenceEvent}
            start={eventView.start}
            end={eventView.end}
          />
        </Fragment>
      </TransitionChart>
    </DataSection>
  );
}

export default EventBreakpointChart;

const SummaryButtonWrapper = styled('div')`
  display: flex;
  flex-direction: row-reverse;
  margin-right: 10px;
`;
