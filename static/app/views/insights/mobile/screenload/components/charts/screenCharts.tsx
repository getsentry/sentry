import {Fragment, useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from 'sentry/components/core/alert';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {type EventsMetaType} from 'sentry/utils/discover/eventView';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesName} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesName';
// TODO(release-drawer): Only used in mobile/screenload/components/
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {ScreensBarChart} from 'sentry/views/insights/mobile/screenload/components/charts/screenBarChart';
import {
  CHART_TITLES,
  YAXIS_COLUMNS,
} from 'sentry/views/insights/mobile/screenload/constants';
import {Referrer} from 'sentry/views/insights/mobile/screenload/referrers';
import {SpanFields} from 'sentry/views/insights/types';

enum YAxis {
  WARM_START = 0,
  COLD_START = 1,
  TTID = 2,
  TTFD = 3,
  SLOW_FRAME_RATE = 4,
  FROZEN_FRAME_RATE = 5,
  THROUGHPUT = 6,
  COUNT = 7,
}

type Props = {
  additionalFilters?: string[];
  chartHeight?: number;
};

const yAxes = [YAxis.TTID, YAxis.TTFD, YAxis.COUNT];

export function ScreenCharts({additionalFilters}: Props) {
  const theme = useTheme();
  const {isProjectCrossPlatform, selectedPlatform: platform} = useCrossPlatformProject();

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const queryString = useMemo(() => {
    const query = new MutableSearch([
      'is_transaction:true',
      'transaction.op:[ui.load,navigation]',
      ...(additionalFilters ?? []),
    ]);

    if (isProjectCrossPlatform) {
      query.addFilterValue('os.name', platform);
    }

    query.addFilterValue('is_transaction', 'true');

    return appendReleaseFilters(query, primaryRelease, secondaryRelease);
  }, [
    additionalFilters,
    isProjectCrossPlatform,
    platform,
    primaryRelease,
    secondaryRelease,
  ]);

  const query = new MutableSearch(queryString);
  const groupBy = SpanFields.RELEASE;
  const referrer = Referrer.SCREENLOAD_LANDING_DURATION_CHART;

  const {
    data,
    isPending: isSeriesLoading,
    error: seriesError,
  } = useFetchSpanTimeSeries(
    {
      groupBy: [groupBy],
      topEvents: 2,
      yAxis: [
        'avg(measurements.time_to_initial_display)',
        'avg(measurements.time_to_full_display)',
        'count()',
      ],
      query,
    },
    referrer
  );

  const timeSeries = data?.timeSeries ?? [];

  useEffect(() => {
    if (defined(primaryRelease) || isReleasesLoading) {
      return;
    }
    Sentry.captureException(new Error('Screen summary missing releases'));
  }, [primaryRelease, isReleasesLoading]);

  const transformedReleaseSeries: Record<string, Record<string, Series>> = {};
  yAxes.forEach(val => {
    transformedReleaseSeries[YAXIS_COLUMNS[val]] = {};
  });

  const seriesMap: Record<
    | 'avg(measurements.time_to_initial_display)'
    | 'avg(measurements.time_to_full_display)'
    | 'count()',
    TimeSeries[]
  > = {
    'avg(measurements.time_to_initial_display)': [],
    'avg(measurements.time_to_full_display)': [],
    'count()': [],
  };

  let chartAliases = {};
  const meta: EventsMetaType = {
    fields: {},
    units: {},
  };

  timeSeries.forEach(release => {
    const releaseName =
      typeof release.groupBy?.[0]?.value === 'string' ? release.groupBy?.[0]?.value : '';
    if (!releaseName) {
      return;
    }

    const isPrimary = releaseName === primaryRelease;
    const version = formatVersion(releaseName, true);

    const yAxis = release.yAxis as
      | 'avg(measurements.time_to_initial_display)'
      | 'avg(measurements.time_to_full_display)'
      | 'count()';

    const plottableName = formatTimeSeriesName(release);

    // This ensures the primary release is always the first in the series, which will give it the first color.
    if (isPrimary) {
      seriesMap[yAxis] = [release, ...seriesMap[yAxis]];
    } else {
      seriesMap[yAxis] = [...seriesMap[yAxis], release];
    }

    chartAliases = {
      ...chartAliases,
      [plottableName]: version,
    };

    // seriesNames.forEach(seriesName => {
    //   const releaseSeries = release.data[seriesName];
    //   const newSeriesName = `${seriesName} ${version}`;
    //   chartAliases = {
    //     ...chartAliases,
    //     [newSeriesName]: version,
    //   };

    //   if (releaseSeries.meta?.fields[seriesName]) {
    //     meta.fields[newSeriesName] = releaseSeries.meta?.fields[seriesName];
    //   }

    //   if (releaseSeries.meta?.units[seriesName]) {
    //     meta.units[newSeriesName] = releaseSeries.meta?.units[seriesName];
    //   }

    //   seriesMap[seriesName].push({
    //     data: releaseSeries.data,
    //     meta,
    //     color,
    //     seriesName: newSeriesName,
    //   });
    // });
  });

  if (isReleasesLoading) {
    return <LoadingContainer />;
  }

  if (!defined(primaryRelease) && !isReleasesLoading) {
    return (
      <Alert.Container>
        <Alert type="warning">
          {t('Invalid selection. Try a different release or date range.')}
        </Alert>
      </Alert.Container>
    );
  }

  function renderCharts() {
    return (
      <Fragment>
        <ChartContainer>
          <ScreensBarChart search={query} type="ttid" chartHeight={150} />
          <InsightsLineChartWidget
            queryInfo={{search: query, groupBy: [groupBy], referrer}}
            title={t('Average TTID')}
            timeSeries={seriesMap['avg(measurements.time_to_initial_display)']}
            isLoading={isSeriesLoading}
            error={seriesError}
            aliases={chartAliases}
            showReleaseAs="none"
            showLegend="always"
            height="100%"
          />
          <InsightsLineChartWidget
            queryInfo={{search: query, groupBy: [groupBy], referrer}}
            title={CHART_TITLES[YAxis.COUNT]}
            timeSeries={seriesMap['count()']}
            isLoading={isSeriesLoading}
            error={seriesError}
            aliases={chartAliases}
            showReleaseAs="none"
            showLegend="always"
            height="100%"
          />
          <ScreensBarChart search={query} type="ttfd" chartHeight={150} />
          <InsightsLineChartWidget
            queryInfo={{search: query, groupBy: [groupBy], referrer}}
            title={t('Average TTFD')}
            timeSeries={seriesMap['avg(measurements.time_to_full_display)']}
            isLoading={isSeriesLoading}
            error={seriesError}
            aliases={chartAliases}
            showReleaseAs="none"
            showLegend="always"
            height="100%"
          />
        </ChartContainer>
      </Fragment>
    );
  }

  return <div data-test-id="starfish-mobile-view">{renderCharts()}</div>;
}

const ChartContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${space(2)};
  padding-bottom: ${space(2)};
`;
