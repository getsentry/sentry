import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart} from 'sentry/components/charts/lineChart';
import {RELATIVE_DAYS_WINDOW} from 'sentry/components/events/eventStatisticalDetector/consts';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueType} from 'sentry/types/group';
import type {EventsStatsData} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import type {MetaType} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {RateUnit} from 'sentry/utils/discover/fields';
import type {DiscoverQueryProps} from 'sentry/utils/discover/genericDiscoverQuery';
import {useGenericDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatRate} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useProfileEventsStats} from 'sentry/utils/profiling/hooks/useProfileEventsStats';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import transformEventStats from 'sentry/views/performance/trends/utils/transformEventStats';

const BUCKET_SIZE = 6 * 60 * 60; // 6 hours in seconds;

type DataBucket = {
  interval: number;
  timestamp: number;
  value: number;
};

interface EventThroughputProps {
  event: Event;
  group: Group;
}

export function EventThroughput({event, group}: EventThroughputProps) {
  if (!isValidRegressionEvent(event, group)) {
    return null;
  }

  return <EventThroughputInner event={event} group={group} />;
}

function EventThroughputInner({event, group}: EventThroughputProps) {
  const theme = useTheme();

  const evidenceData = event.occurrence!.evidenceData;
  const breakpoint = evidenceData.breakpoint;

  const datetime = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: RELATIVE_DAYS_WINDOW,
  });

  const stats = useThroughputStats({datetime, event, group});

  const [throughputBefore, throughputAfter, throughputDelta] = useMemo(() => {
    const [beforeBuckets, afterBuckets] = partition(
      stats.series,
      item => item.timestamp < breakpoint
    );

    if (beforeBuckets.length <= 0 || afterBuckets.length <= 0) {
      return [0, 0];
    }

    const beforeBucket = beforeBuckets.reduce((acc, cur) => {
      if (!acc) {
        return {...cur};
      }
      acc.value += cur.value;
      acc.interval += cur.interval;
      return acc;
    }, null);
    const afterBucket = afterBuckets.reduce((acc, cur) => {
      if (!acc) {
        return {...cur};
      }
      acc.value += cur.value;
      acc.interval += cur.interval;
      return acc;
    }, null);

    const before = beforeBucket.value / beforeBucket.interval;
    const after = afterBucket.value / afterBucket.interval;
    return [before, after, after / before - 1];
  }, [breakpoint, stats.series]);

  const series = useMemo(() => {
    const result = transformEventStats(
      stats.series.map(item => [item.timestamp, [{count: item.value / item.interval}]]),
      'throughput()'
    )[0]!;

    result.markLine = {
      data: [
        {
          xAxis: breakpoint * 1000,
        },
      ],
      label: {show: false},
      lineStyle: {
        color: theme.red300,
        type: 'solid',
        width: 2,
      },
      symbol: ['none', 'none'],
      tooltip: {
        show: false,
      },
      silent: true,
    };

    return [result];
  }, [breakpoint, stats.series, theme]);

  const chartOptions: Omit<
    React.ComponentProps<typeof LineChart>,
    'series'
  > = useMemo(() => {
    return {
      grid: {
        top: '20px',
        bottom: '0px',
      },
      height: 100,
      tooltip: {
        valueFormatter: value => tooltipFormatter(value),
      },
      xAxis: {show: false, type: 'time'},
      yAxis: {
        axisLabel: {
          color: theme.chartLabel,
          formatter: (value: number) =>
            axisLabelFormatter(value, 'rate', true, undefined, RateUnit.PER_SECOND),
        },
        splitLine: {show: false},
        splitNumber: 1,
      },
    };
  }, [theme]);

  return (
    <SidebarSection.Wrap data-test-id="throughput">
      <SidebarSection.Title>{t('Change in Throughput')}</SidebarSection.Title>
      {stats.series.length > 0 ? (
        <CurrentLabel>{formatRate(throughputAfter, RateUnit.PER_SECOND)}</CurrentLabel>
      ) : (
        <CurrentLabel>{'\u2014'}</CurrentLabel>
      )}
      {throughputDelta && throughputDelta > 0 ? (
        <CompareLabel change="increase">
          {t(
            'Up %s from %s',
            `+${formatPercentage(throughputDelta)}`,
            formatRate(throughputBefore, RateUnit.PER_SECOND)
          )}
        </CompareLabel>
      ) : throughputDelta && throughputDelta < 0 ? (
        <CompareLabel change="decrease">
          {t(
            'Down %s from %s',
            formatPercentage(throughputDelta),
            formatRate(throughputBefore, RateUnit.PER_SECOND)
          )}
        </CompareLabel>
      ) : stats.series.length > 0 ? (
        <CompareLabel>
          {t('Unchanged from', formatRate(throughputBefore, RateUnit.PER_SECOND))}
        </CompareLabel>
      ) : (
        <CompareLabel>{'\u2014'}</CompareLabel>
      )}
      <ChartZoom {...datetime}>
        {zoomRenderProps => (
          <LineChart {...zoomRenderProps} {...chartOptions} series={series} />
        )}
      </ChartZoom>
    </SidebarSection.Wrap>
  );
}

interface UseThroughputStatsOptions {
  datetime: PageFilters['datetime'];
  event: Event;
  group: Group;
}

function useThroughputStats({datetime, event, group}: UseThroughputStatsOptions) {
  const location = useLocation();
  const organization = useOrganization();

  const evidenceData = event.occurrence!.evidenceData;

  const statsType = getStatsType(group);

  // START Functions ====================

  const functionStats = useProfileEventsStats({
    dataset: 'profileFunctions',
    datetime,
    query: `fingerprint:${evidenceData?.fingerprint}`,
    referrer: 'api.profiling.functions.regression.stats',
    yAxes: ['count()'],
    // only make query if statsType matches
    enabled: statsType === 'functions',
  });

  const functionInterval = useMemo(() => {
    const timestamps = functionStats?.data?.timestamps ?? [];
    if (timestamps.length < 2) {
      return null;
    }
    return timestamps[1] - timestamps[0];
  }, [functionStats?.data]);

  const functionData = useMemo(() => {
    if (!functionInterval) {
      return [];
    }

    const rawData = functionStats?.data?.data?.find(({axis}) => axis === 'count()');
    const timestamps = functionStats?.data?.timestamps ?? [];
    return timestamps.reduce((acc, timestamp, idx) => {
      const bucket = Math.floor(timestamp / BUCKET_SIZE) * BUCKET_SIZE;
      const prev: DataBucket = acc[acc.length - 1];
      const value = rawData.values[idx];

      if (prev?.timestamp === bucket) {
        prev.value += value;
        prev.interval += functionInterval;
      } else {
        acc.push({timestamp: bucket, value, interval: functionInterval});
      }
      return acc;
    }, [] as DataBucket[]);
  }, [functionStats?.data, functionInterval]);

  // END Functions ====================

  // START Transactions ====================

  const eventView = useMemo(() => {
    const view = EventView.fromLocation(location);
    view.dataset = DiscoverDatasets.METRICS;

    view.start = (datetime.start as Date).toISOString();
    view.end = (datetime.end as Date).toISOString();
    view.statsPeriod = undefined;

    const query = new MutableSearch(['event.type:transaction']);
    if (defined(evidenceData?.transaction)) {
      query.setFilterValues('transaction', [evidenceData.transaction]);
    }
    view.query = query.formatString();

    return view;
  }, [location, evidenceData?.transaction, datetime]);

  const transactionStats = useGenericDiscoverQuery<
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
      yAxis: ['count()'],
    }),
    // only make query if statsType matches
    options: {enabled: statsType === 'transactions'},
  });

  const transactionInterval = useMemo(() => {
    const data = transactionStats?.data?.data ?? [];
    if (data.length < 2) {
      return null;
    }
    return data[1]![0] - data[0]![0];
  }, [transactionStats?.data]);

  const transactionData = useMemo(() => {
    if (!transactionInterval) {
      return [];
    }

    return (transactionStats?.data?.data ?? []).reduce((acc, curr) => {
      const timestamp = curr[0];
      const bucket = Math.floor(timestamp / BUCKET_SIZE) * BUCKET_SIZE;
      const prev = acc[acc.length - 1];
      const value = curr[1]![0]!.count;

      if (prev?.timestamp === bucket) {
        prev.value += value;
        prev.interval += transactionInterval;
      } else {
        acc.push({timestamp: bucket, value, interval: transactionInterval});
      }

      return acc;
    }, [] as DataBucket[]);
  }, [transactionInterval, transactionStats?.data]);

  // END Transactions ====================

  if (statsType === 'functions' && functionInterval) {
    return {
      isLoading: functionStats.isPending,
      isError: functionStats.isError,
      series: functionData,
    };
  }

  if (statsType === 'transactions' && transactionInterval) {
    return {
      isLoading: transactionStats.isPending,
      isError: transactionStats.isError,
      series: transactionData,
    };
  }

  return {
    isLoading: false,
    isError: false,
    series: [],
  };
}

function isValidRegressionEvent(event: Event, group: Group): boolean {
  switch (group.issueType) {
    case IssueType.PERFORMANCE_DURATION_REGRESSION:
    case IssueType.PERFORMANCE_ENDPOINT_REGRESSION: {
      const evidenceData = event.occurrence?.evidenceData;
      return defined(evidenceData?.transaction) && defined(evidenceData?.breakpoint);
    }
    case IssueType.PROFILE_FUNCTION_REGRESSION_EXPERIMENTAL:
    case IssueType.PROFILE_FUNCTION_REGRESSION: {
      const evidenceData = event.occurrence?.evidenceData;
      return defined(evidenceData?.fingerprint) && defined(evidenceData?.breakpoint);
    }
    default:
      return false;
  }
}

function getStatsType(group: Group): 'transactions' | 'functions' | null {
  switch (group.issueType) {
    case IssueType.PERFORMANCE_DURATION_REGRESSION:
    case IssueType.PERFORMANCE_ENDPOINT_REGRESSION:
      return 'transactions';
    case IssueType.PROFILE_FUNCTION_REGRESSION_EXPERIMENTAL:
    case IssueType.PROFILE_FUNCTION_REGRESSION:
      return 'functions';
    default:
      return null;
  }
}

const CurrentLabel = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const CompareLabel = styled('div')<{change?: 'increase' | 'decrease'}>`
  color: ${p =>
    p.change === 'increase'
      ? p.theme.red300
      : p.change === 'decrease'
        ? p.theme.green300
        : p.theme.gray300};
`;
