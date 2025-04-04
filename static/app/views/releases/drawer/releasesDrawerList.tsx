import {Fragment, type ReactElement, useCallback, useContext, useRef} from 'react';
import styled from '@emotion/styled';
import type {SeriesOption} from 'echarts';
import type {MarkLineOption} from 'echarts/types/dist/shared';
import type {EChartsInstance} from 'echarts-for-react';

import {DateTime} from 'sentry/components/dateTime';
import {
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
} from 'sentry/components/events/eventDrawer';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef, SeriesDataUnit} from 'sentry/types/echarts';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {ChartRendererProps} from 'sentry/views/releases/releaseBubbles/types';

type ChartRenderer = (props: ChartRendererProps) => ReactElement;
import {ReleasesDrawerContext} from 'sentry/views/releases/drawer/releasesDrawerContext';

import {ReleaseDrawerTable} from './releasesDrawerTable';

interface ReleasesDrawerListProps {
  charts: Record<string, ChartRenderer>;
  endTs: number;
  environments: readonly string[];
  projects: readonly number[];
  startTs: number;
  /**
   * A renderer function that returns a chart. It is called with the trimmed
   * list of releases and timeSeries. It currently uses the
   * `TimeSeriesWidgetVisualization` components props. It's possible we change
   * it to make the props more generic, e.g. pass start/end timestamps and do
   * the series manipulation when we call the bubble hook.
   */
  chartRenderer?: (rendererProps: ChartRendererProps) => ReactElement;
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
export function ReleasesDrawerList({
  startTs,
  endTs,
  projects,
  environments,
  charts,
}: ReleasesDrawerListProps) {
  const location = useLocation();
  const start = new Date(startTs);
  const end = new Date(endTs);
  const pageFilters = usePageFilters();
  const {releases} = useReleaseStats({
    ...pageFilters.selection,
    datetime: {
      start: startTs ? new Date(startTs).toISOString() : null,
      end: endTs ? new Date(endTs).toISOString() : null,
    },
  });
  const {getChart} = useContext(ReleasesDrawerContext);
  const chartRef = useRef<ReactEchartsRef | null>(null);

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
  // const chartRenderer = charts.get(String(location.query.rdChartId));
  const chartRenderer = getChart(String(location.query.rdChartId));

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs crumbs={crumbs} />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{title}</Header>
      </EventNavigator>
      <EventDrawerBody>
        {chartRenderer ? (
          <ChartContainer>
            <Widget
              Title={
                <Fragment>
                  {t('Releases from ')}
                  <DateTime date={start} /> <span>{t('to')}</span> <DateTime date={end} />
                </Fragment>
              }
              Visualization={chartRenderer?.({
                ref: (e: ReactEchartsRef | null) => {
                  chartRef.current = e;

                  if (e) {
                    // When chart is mounted, zoom the chart into the relevant
                    // bucket
                    e.getEchartsInstance().dispatchAction({
                      type: 'dataZoom',
                      batch: [
                        {
                          // data value at starting location
                          startValue: startTs,
                          // data value at ending location
                          endValue: endTs,
                        },
                      ],
                    });
                  }
                },
                releases,
                start,
                end,
              })}
            />
          </ChartContainer>
        ) : null}
        <ReleaseDrawerTable
          projects={projects}
          environments={environments}
          start={start.toISOString()}
          end={end.toISOString()}
          onMouseOverRelease={handleMouseOverRelease}
          onMouseOutRelease={handleMouseOutRelease}
        />
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

const ChartContainer = styled('div')`
  margin-bottom: ${space(2)};
`;
