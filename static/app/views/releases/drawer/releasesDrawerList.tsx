import {useCallback, useRef} from 'react';
import type {ECharts, SeriesOption} from 'echarts';
import type {MarkLineOption} from 'echarts/types/dist/shared';

import {
  type ChartId,
  ChartWidgetLoader,
} from 'sentry/components/charts/chartWidgetLoader';
import {
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
} from 'sentry/components/events/eventDrawer';
import type {RawFlag} from 'sentry/components/featureFlags/utils';
import {t, tn} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {
  EChartDataZoomHandler,
  ReactEchartsRef,
  SeriesDataUnit,
} from 'sentry/types/echarts';
import {getUtcDateString} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {EVENT_GRAPH_WIDGET_ID} from 'sentry/views/issueDetails/streamline/eventGraphWidget';
import {ReleasesDrawerFeatureFlagsTable} from 'sentry/views/releases/drawer/releasesDrawerFeatureFlagsTable';
import {ReleasesDrawerFields} from 'sentry/views/releases/drawer/utils';

import {ReleasesDrawerTable} from './releasesDrawerTable';

interface ReleasesDrawerListProps {
  pageFilters: PageFilters;
  chart?: ChartId;
  eventId?: string | undefined;
}

type MarkLineDataCallbackFn = (item: SeriesDataUnit) => boolean;

function createMarkLineUpdater(lineStyle: Partial<MarkLineOption['lineStyle']>) {
  return (
    echartsInstance: ECharts,
    seriesId: string,
    callbackFn: MarkLineDataCallbackFn
  ) => {
    const opts = echartsInstance.getOption();
    const series = (opts.series as SeriesOption[]).find(({id}) => id === seriesId);

    // We need to return all markLines (I could not get merges working on it,
    // even when I added the release version as id), otherwise the other lines
    // will be removed.
    const updatedData = series?.markLine.data.map((d: SeriesDataUnit) => {
      // Update the style of the lines that is currently being hovered over so
      // that it is more visible than other lines on the chart
      if (callbackFn(d)) {
        return {
          ...d,
          lineStyle,
        };
      }

      return d;
    });

    echartsInstance.setOption({
      series: {
        id: seriesId,
        markLine: {
          data: updatedData,
        },
      },
    });
  };
}

/**
 * Find markLine(s) to highlight
 * Note: We can't use ECharts `highlight` event because it only works for series
 * (not markLines)
 */
const highlightMarkLines = createMarkLineUpdater({width: 2, opacity: 1});
/**
 * Unhighlight all markLines
 */
const unhighlightMarkLines = createMarkLineUpdater({});

/**
 * Renders the a chart + releases table for use in the Global Drawer.
 * Allows users to view releases of a specific timebucket.
 */
export function ReleasesDrawerList({
  chart,
  pageFilters,
  eventId,
}: ReleasesDrawerListProps) {
  const navigate = useNavigate();
  const {groupId} = useParams();
  const {releases} = useReleaseStats(pageFilters);
  const location = useLocation();
  const chartRef = useRef<ReactEchartsRef | null>(null);
  const chartHeight = chart === EVENT_GRAPH_WIDGET_ID ? '160px' : '220px';

  const handleMouseOverFlag = useCallback((flag: RawFlag) => {
    if (!chartRef.current) {
      return;
    }

    highlightMarkLines(
      chartRef.current.getEchartsInstance(),
      'flag-lines',
      (d: SeriesDataUnit) => d.name === flag.flag
    );
  }, []);
  const handleMouseOutFlag = useCallback((flag: RawFlag) => {
    if (!chartRef.current) {
      return;
    }

    unhighlightMarkLines(
      chartRef.current.getEchartsInstance(),
      'flag-lines',
      (d: SeriesDataUnit) => d.name === flag.flag
    );
  }, []);
  const handleMouseOverRelease = useCallback((release: string) => {
    if (!chartRef.current) {
      return;
    }

    highlightMarkLines(
      chartRef.current.getEchartsInstance(),
      'release-lines',
      (d: SeriesDataUnit) => d.name === formatVersion(release, true)
    );
  }, []);

  const handleMouseOutRelease = useCallback((release: string) => {
    if (!chartRef.current) {
      return;
    }

    unhighlightMarkLines(
      chartRef.current.getEchartsInstance(),
      'release-lines',
      (d: SeriesDataUnit) => d.name === formatVersion(release, true)
    );
  }, []);

  const title = tn('%s Release', '%s Releases', releases?.length ?? 0);

  const crumbs = [
    {
      label: t('Releases'),
    },
  ];

  const handleDataZoom = useCallback<EChartDataZoomHandler>(
    evt => {
      let {startValue, endValue} = (evt as any).batch[0] as {
        endValue: number | null;
        startValue: number | null;
      };

      // if `rangeStart` and `rangeEnd` are null, then we are going back
      if (startValue && endValue) {
        // round off the bounds to the minute
        startValue = Math.floor(startValue / 60_000) * 60_000;
        endValue = Math.ceil(endValue / 60_000) * 60_000;

        // ensure the bounds has 1 minute resolution
        startValue = Math.min(startValue, endValue - 60_000);

        navigate({
          query: {
            ...location.query,
            [ReleasesDrawerFields.START]: getUtcDateString(startValue),
            [ReleasesDrawerFields.END]: getUtcDateString(endValue),
          },
        });
      }
    },
    [navigate, location.query]
  );

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs crumbs={crumbs} />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{title}</Header>
      </EventNavigator>
      <EventDrawerBody>
        {chart ? (
          <div style={{height: chartHeight}}>
            <ChartWidgetLoader
              ref={chartRef}
              id={chart}
              height={chartHeight}
              pageFilters={pageFilters}
              showReleaseAs="line"
              loaderSource="releases-drawer"
              onZoom={handleDataZoom}
            />
          </div>
        ) : null}

        <ReleasesDrawerTable
          {...pageFilters}
          onMouseOverRelease={handleMouseOverRelease}
          onMouseOutRelease={handleMouseOutRelease}
        />

        {eventId && groupId && (
          <ReleasesDrawerFeatureFlagsTable
            pageFilters={pageFilters}
            eventId={eventId}
            groupId={groupId}
            onRowMouseOver={handleMouseOverFlag}
            onRowMouseOut={handleMouseOutFlag}
          />
        )}
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
