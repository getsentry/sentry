import {useCallback, useRef} from 'react';
import type {SeriesOption} from 'echarts';
import type {MarkLineOption} from 'echarts/types/dist/shared';
import type {EChartsInstance} from 'echarts-for-react';

<<<<<<< HEAD
=======
import {DateTime} from 'sentry/components/dateTime';
>>>>>>> 18d80c7d98b (feat(releases): Use routing for Releases Drawer)
import {
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
} from 'sentry/components/events/eventDrawer';
import {t, tn} from 'sentry/locale';
<<<<<<< HEAD
import type {ReactEchartsRef, SeriesDataUnit} from 'sentry/types/echarts';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
=======
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef, SeriesDataUnit} from 'sentry/types/echarts';
import type {ReleaseMetaBasic} from 'sentry/types/release';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {ChartRendererProps} from 'sentry/views/releases/releaseBubbles/types';
>>>>>>> 18d80c7d98b (feat(releases): Use routing for Releases Drawer)

import {ReleaseDrawerTable} from './releasesDrawerTable';

interface ReleasesDrawerListProps {
<<<<<<< HEAD
  end: Date;
=======
  endTs: number;
>>>>>>> 18d80c7d98b (feat(releases): Use routing for Releases Drawer)
  environments: readonly string[];
  projects: readonly number[];
  start: Date;
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
<<<<<<< HEAD
  start,
  end,
  projects,
  environments,
}: ReleasesDrawerListProps) {
=======
  startTs,
  endTs,
  chartRenderer,
  projects,
  environments,
}: ReleasesDrawerListProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const start = new Date(startTs);
  const end = new Date(endTs);
>>>>>>> 18d80c7d98b (feat(releases): Use routing for Releases Drawer)
  const pageFilters = usePageFilters();
  const {releases} = useReleaseStats({
    ...pageFilters.selection,
    datetime: {
<<<<<<< HEAD
      start,
      end,
    },
  });
=======
      start: startTs ? new Date(startTs).toISOString() : null,
      end: endTs ? new Date(endTs).toISOString() : null,
    },
  });
  const handleSelectRelease = useCallback(
    (nextSelectedRelease: string, projectId: string) => {
      navigate({
        query: {
          ...location.query,
          release: nextSelectedRelease,
          projectId,
        },
      });
    },
    [navigate, location.query]
  );
>>>>>>> 18d80c7d98b (feat(releases): Use routing for Releases Drawer)
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

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs crumbs={crumbs} />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{title}</Header>
      </EventNavigator>
      <EventDrawerBody>
        <ReleaseDrawerTable
          projects={projects}
          environments={environments}
          start={start}
          end={end}
          onMouseOverRelease={handleMouseOverRelease}
          onMouseOutRelease={handleMouseOutRelease}
        />
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
