import React from 'react';
import styled from '@emotion/styled';

import MiniBarChart from 'app/components/charts/miniBarChart';
import {t} from 'app/locale';
import theme from 'app/utils/theme';
import space from 'app/styles/space';
import {Series} from 'app/types/echarts';
import {Group, TimeseriesValue, Release} from 'app/types';

type Markers = React.ComponentProps<typeof MiniBarChart>['markers'];

/**
 * Stats are provided indexed by statsPeriod strings.
 */
type StatsGroup = Record<string, TimeseriesValue[]>;

type Props = {
  group: Group;
  statsPeriod: string;
  title: string;
  className?: string;
  firstSeen?: string;
  lastSeen?: string;
  environment?: string;
  release?: Release;
  releaseStats?: StatsGroup;
  environmentStats?: StatsGroup;
};

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
    environmentStats,
    title,
  } = props;

  const stats = group.stats[statsPeriod];
  if (!stats || !stats.length) {
    return null;
  }
  const series: Series[] = [];
  // Add all events.
  series.push({
    seriesName: t('Events'),
    data: stats.map(point => ({name: point[0] * 1000, value: point[1]})),
  });

  // Get the timestamp of the first point.
  const firstTime = series[0].data[0].value;

  if (environment && environmentStats) {
    series.push({
      seriesName: t('Events in %s', environment),
      data: environmentStats[statsPeriod].map(point => ({
        name: point[0] * 1000,
        value: point[1],
      })),
    });
  }

  if (release && releaseStats) {
    series.push({
      seriesName: t('Events in %s', release.version),
      data: releaseStats[statsPeriod].map(point => ({
        name: point[0] * 1000,
        value: point[1],
      })),
    });
  }

  const markers: Markers = [];
  if (firstSeen) {
    const firstSeenX = new Date(firstSeen).getTime();
    if (firstSeenX >= firstTime) {
      markers.push({
        name: t('First seen'),
        value: firstSeenX,
        color: theme.pink400,
      });
    }
  }

  if (lastSeen) {
    const lastSeenX = new Date(lastSeen).getTime();
    if (lastSeenX >= firstTime) {
      markers.push({
        name: t('Last seen'),
        value: lastSeenX,
        color: theme.green400,
      });
    }
  }

  return (
    <Wrapper className={className}>
      <h6>{title}</h6>
      <MiniBarChart
        isGroupedByDate
        showTimeInTooltip
        height={42}
        series={series}
        markers={markers}
      />
    </Wrapper>
  );
}

export default GroupReleaseChart;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;
