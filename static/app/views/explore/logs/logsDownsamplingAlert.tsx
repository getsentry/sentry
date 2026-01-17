import {useMemo} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import type {UseInfiniteLogsQueryResult} from 'sentry/views/explore/logs/useLogsQuery';
import {useQueryParamsTopEventsLimit} from 'sentry/views/explore/queryParams/context';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface LogsDownSamplingAlertProps {
  tableResult: UseInfiniteLogsQueryResult;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function LogsDownSamplingAlert({
  tableResult,
  timeseriesResult,
}: LogsDownSamplingAlertProps) {
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const isTopEvents = defined(topEventsLimit);

  const timeseriesSamples = useMemo(() => {
    for (const series of Object.values(timeseriesResult.data || {})) {
      const samplingMeta = determineSeriesSampleCountAndIsSampled(series, isTopEvents);
      return samplingMeta.sampleCount;
    }
    return 0;
  }, [timeseriesResult.data, isTopEvents]);

  const timeseriesDataScanned = useMemo(() => {
    const dataScannedList = Object.values(timeseriesResult.data || {})
      .flat()
      .map(series => series.meta.dataScanned);
    if (!dataScannedList.length) {
      return undefined;
    }
    return dataScannedList.includes('partial') ? ('partial' as const) : ('full' as const);
  }, [timeseriesResult.data]);

  const tableDataScanned = tableResult.dataScanned;
  const tableSamples = tableResult.data.length;

  if (
    // It's possible that the timeseries data and table data are produced using
    // different tiers of data. When this happens, specifically, when the table
    // is using the full data and the chart is using partial data, this warning
    // is here to educate the user that the results they're seeing may be a
    // little strange as there is more data in the table than the chart leads
    // one to believe.
    timeseriesDataScanned === 'partial' &&
    tableDataScanned === 'full' &&
    // If the number of samples in the timeseries is greater than or equals to
    // the number of samples in the table, then any potential discrepancy isn't
    // very noticable so no need to explicitly call it out.
    timeseriesSamples < tableSamples
  ) {
    return (
      <Alert.Container>
        <Alert variant="warning">
          {t(
            'The volume of logs in this time range is too large for us to do a full scan for the chart. Try reducing the date range or number of projects to attempt scanning all logs.'
          )}
        </Alert>
      </Alert.Container>
    );
  }
  return null;
}
