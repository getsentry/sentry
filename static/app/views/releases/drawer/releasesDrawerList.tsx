import {useCallback, useRef} from 'react';
import type {SeriesOption} from 'echarts';
import type {MarkLineOption} from 'echarts/types/dist/shared';
import type {EChartsInstance} from 'echarts-for-react';

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
import {t, tn} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {ReactEchartsRef, SeriesDataUnit} from 'sentry/types/echarts';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {EVENT_GRAPH_WIDGET_ID} from 'sentry/views/issueDetails/streamline/eventGraphWidget';

import {ReleaseDrawerTable} from './releasesDrawerTable';

interface ReleasesDrawerListProps {
  pageFilters: PageFilters;
  chart?: ChartId;
}

type MarkLineDataCallbackFn = (item: SeriesDataUnit) => boolean;

function createMarkLineUpdater(lineStyle: Partial<MarkLineOption['lineStyle']>) {
  return (
    echartsInstance: EChartsInstance,
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
export function ReleasesDrawerList({chart, pageFilters}: ReleasesDrawerListProps) {
  const {releases} = useReleaseStats(pageFilters);
  const chartRef = useRef<ReactEchartsRef | null>(null);
  const chartHeight = chart === EVENT_GRAPH_WIDGET_ID ? 'auto' : '220px';

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
              id={chart}
              height={chartHeight}
              pageFilters={pageFilters}
              showReleaseAs="line"
            />
          </div>
        ) : null}

        <ReleaseDrawerTable
          {...pageFilters}
          onMouseOverRelease={handleMouseOverRelease}
          onMouseOutRelease={handleMouseOutRelease}
        />
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
