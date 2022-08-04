import MiniBarChart from 'sentry/components/charts/miniBarChart';
import Count from 'sentry/components/count';
import {t} from 'sentry/locale';
import type {Group, Release, TimeseriesValue} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import {formatVersion} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';

import SidebarSection from './sidebarSection';

type Markers = React.ComponentProps<typeof MiniBarChart>['markers'];

/**
 * Stats are provided indexed by statsPeriod strings.
 */
type StatsGroup = Record<string, TimeseriesValue[]>;

interface Props {
  group: Group;
  statsPeriod: string;
  title: string;
  className?: string;
  environment?: string;
  environmentLabel?: string;
  environmentStats?: StatsGroup;
  firstSeen?: string;
  lastSeen?: string;
  release?: Release;
  releaseStats?: StatsGroup;
}

export function getGroupReleaseChartMarkers(
  stats: TimeseriesValue[],
  firstSeen?: string,
  lastSeen?: string
): NonNullable<Markers> {
  const markers: Markers = [];
  // Get the timestamp of the first point.
  const firstGraphTime = stats[0][0] * 1000;

  const firstSeenX = new Date(firstSeen ?? 0).getTime();
  const lastSeenX = new Date(lastSeen ?? 0).getTime();

  if (firstSeen && stats.length > 2 && firstSeenX >= firstGraphTime) {
    // Find the first bucket that would contain our first seen event
    const firstBucket = stats.findIndex(([time]) => time * 1000 > firstSeenX);

    let bucketStart: number | undefined;
    if (firstBucket > 0) {
      // The size of the data interval in ms
      const halfBucketSize = ((stats[1][0] - stats[0][0]) * 1000) / 2;
      // Display the marker closer to the front of the bucket
      bucketStart = stats[firstBucket - 1][0] * 1000 - halfBucketSize;
    }

    markers.push({
      name: t('First seen'),
      value: bucketStart ?? firstSeenX,
      tooltipValue: firstSeenX,
      color: theme.pink300,
    });
  }

  if (lastSeen && lastSeenX >= firstGraphTime) {
    markers.push({
      name: t('Last seen'),
      value: lastSeenX,
      color: theme.green300,
    });
  }

  return markers;
}

function GroupReleaseChart(props: Props) {
  const {
    className,
    group,
    lastSeen,
    firstSeen,
    statsPeriod,
    release,
    releaseStats,
    environment,
    environmentLabel,
    environmentStats,
    title,
  } = props;

  const stats = group.stats[statsPeriod];
  const environmentPeriodStats = environmentStats?.[statsPeriod];
  if (!stats || !stats.length || !environmentPeriodStats) {
    return null;
  }

  const series: Series[] = [];

  if (environment) {
    // Add all events.
    series.push({
      seriesName: t('Events'),
      data: stats.map(point => ({name: point[0] * 1000, value: point[1]})),
    });
  }

  series.push({
    seriesName: t('Events in %s', environmentLabel),
    data: environmentStats[statsPeriod].map(point => ({
      name: point[0] * 1000,
      value: point[1],
    })),
  });

  if (release && releaseStats) {
    series.push({
      seriesName: t('Events in release %s', formatVersion(release.version)),
      data: releaseStats[statsPeriod].map(point => ({
        name: point[0] * 1000,
        value: point[1],
      })),
    });
  }

  const totalSeries =
    environment && environmentStats ? environmentStats[statsPeriod] : stats;
  const totalEvents = totalSeries.reduce((acc, current) => acc + current[1], 0);
  const markers = getGroupReleaseChartMarkers(stats, firstSeen, lastSeen);

  return (
    <SidebarSection secondary title={title} className={className}>
      <div>
        <Count value={totalEvents} />
      </div>
      <MiniBarChart
        isGroupedByDate
        showTimeInTooltip
        height={42}
        colors={environment ? undefined : [theme.purple300, theme.purple300]}
        series={series}
        markers={markers}
      />
    </SidebarSection>
  );
}

export default GroupReleaseChart;
