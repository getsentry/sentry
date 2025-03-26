import {
  Fragment,
  type MutableRefObject,
  type ReactElement,
  useCallback,
  useRef,
} from 'react';
import styled from '@emotion/styled';
import type {SeriesOption} from 'echarts';
import type {MarkLineOption} from 'echarts/types/dist/shared';
import type {EChartsInstance} from 'echarts-for-react';

import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef, SeriesDataUnit} from 'sentry/types/echarts';
import type {ReleaseMetaBasic} from 'sentry/types/release';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {Bucket} from 'sentry/views/releases/releaseBubbles/types';

import {ReleaseDrawerTable} from './releasesDrawerTable';

interface ReleasesDrawerListProps {
  /**
   * This is a list of the release buckets used by eCharts to draw the
   * release bubbles. Currently unused, but we can use this to traverse
   * through the release buckets within the drawer
   */
  buckets: Bucket[];
  endTs: number;
  /**
   * Callback when a release is selected
   */
  onSelectRelease: (release: string, projectId: string) => void;
  /**
   * A list of releases in the current release bucket
   */
  releases: ReleaseMetaBasic[];
  startTs: number;
  /**
   * A renderer function that returns a chart. It is called with the trimmed
   * list of releases and timeSeries. It currently uses the
   * `TimeSeriesWidgetVisualization` components props. It's possible we change
   * it to make the props more generic, e.g. pass start/end timestamps and do
   * the series manipulation when we call the bubble hook.
   */
  chartRenderer?: (rendererProps: {
    end: Date;
    releases: ReleaseMetaBasic[];
    start: Date;
    ref?:
      | MutableRefObject<ReactEchartsRef | null>
      | ((e: ReactEchartsRef | null) => void);
  }) => ReactElement;
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
  chartRenderer,
  releases,
  onSelectRelease,
}: ReleasesDrawerListProps) {
  const start = new Date(startTs);
  const end = new Date(endTs);
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

  return (
    <Fragment>
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
              ref: chartRef,
              releases,
              start,
              end,
            })}
          />
        </ChartContainer>
      ) : null}
      <ReleaseDrawerTable
        start={start.toISOString()}
        end={end.toISOString()}
        onSelectRelease={onSelectRelease}
        onMouseOverRelease={handleMouseOverRelease}
        onMouseOutRelease={handleMouseOutRelease}
      />
    </Fragment>
  );
}

const ChartContainer = styled('div')`
  height: 220px;
  margin-bottom: ${space(2)};
`;
