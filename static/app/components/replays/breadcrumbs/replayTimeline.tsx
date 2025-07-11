import {useCallback, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {AreaChart} from 'sentry/components/charts/areaChart';
import BaseChart from 'sentry/components/charts/baseChart';
import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import StackedAreaChart from 'sentry/components/charts/stackedAreaChart';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {
  MajorGridlines,
  MinorGridlines,
} from 'sentry/components/replays/breadcrumbs/gridlines';
import ReplayTimelineEvents from 'sentry/components/replays/breadcrumbs/replayTimelineEvents';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import TimelineGaps from 'sentry/components/replays/breadcrumbs/timelineGaps';
import {TimelineScrubber} from 'sentry/components/replays/player/scrubber';
import {useTimelineScrubberMouseTracking} from 'sentry/components/replays/player/useScrubberMouseTracking';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import type {EChartMouseEventData, EChartMouseEventParam} from 'sentry/types/echarts';
import divide from 'sentry/utils/number/divide';
import toPercent from 'sentry/utils/number/toPercent';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useTimelineScale from 'sentry/utils/replays/hooks/useTimelineScale';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import type {incrementalSnapshotEvent} from 'sentry/utils/replays/types';
import {getFrameOpOrCategory} from 'sentry/utils/replays/types';
import {useDimensions} from 'sentry/utils/useDimensions';

const USER_INTERACTION_CATEGORY = 'user.action';
const ISSUE_CATEGORY = 'issue';

function createBuckets({
  bucketCount,
  durationMs,
  startTimestampMs,
}: {
  bucketCount: number;
  durationMs: number;
  startTimestampMs: number;
}) {
  const bucketSizeMs = durationMs / bucketCount;
  return Array.from(
    {length: bucketCount},
    (_, index) => startTimestampMs + index * bucketSizeMs
  );
}

// Helper function to create stacked area chart data from chapter frames
function createStackedChartData({
  bucketCount: _,
  durationMs,
  startTimestampMs,
  frames,
  getTimestamp = (frame: unknown) => frame.timestamp || frame.startTimestamp,
}: {
  bucketCount: number;
  durationMs: number;
  frames: unknown[];
  startTimestampMs: number;
  getTimestamp?: (frame: unknown) => number;
}) {
  if (!frames?.length) {
    return [];
  }

  const bucketSizeMs = 1000;
  const bucketCount = Math.ceil(durationMs / bucketSizeMs);
  const buckets = Array.from(
    {length: bucketCount},
    (_, index) => startTimestampMs + index * bucketSizeMs
  );

  // Get unique categories
  // const categories = [
  //   ...new Set([
  //     ...chapterFrames.map(frame => getFrameOpOrCategory(frame)),
  //     ISSUE_CATEGORY,
  //     USER_INTERACTION_CATEGORY,
  //   ]),
  // ].filter(Boolean);

  // Initialize buckets
  const bucketData = buckets.map(bucket => ({
    time: bucket,
    data: 0,
  }));

  // Initialize all categories to 0
  //     categories.forEach(category => {
  //     bucketData.data[category] = 0;
  //   });

  //   return bucketData;
  // });

  // Count frames per category per bucket
  frames.forEach(frame => {
    // const category = getFrameOpOrCategory(frame);
    // if (!category || (!frame.timestamp && !frame.startTimestamp)) return;
    const timestamp = getTimestamp(frame);
    if (!timestamp) return;

    const relativeTimestampMs = timestamp - startTimestampMs;
    const bucketIndex = Math.floor(relativeTimestampMs / bucketSizeMs);

    if (bucketIndex >= 0 && bucketIndex < bucketCount) {
      bucketData[bucketIndex].data += 1;
    }
  });

  // userInteractionEvents.forEach(event => {
  //   const category = USER_INTERACTION_CATEGORY;
  //   if (!category || !event.timestamp) return;

  //   const eventTimeMs = event.timestamp - startTimestampMs;
  //   const bucketIndex = Math.floor(eventTimeMs / bucketSizeMs);

  //   if (bucketIndex >= 0 && bucketIndex < bucketCount) {
  //     buckets[bucketIndex].data[category] += 1;
  //   }
  // });

  return bucketData;
}

function getGroupedCategories(frame: BreadcrumbFrame | SpanFrame) {
  const category = getFrameOpOrCategory(frame);
  if (!category) {
    return null;
  }
  if (category.startsWith('navigation')) {
    return 'navigation';
  }
  if (category.startsWith('ui')) {
    return 'ui';
  }

  return null;
}

export default function ReplayTimeline() {
  const {replay, currentTime, setCurrentTime} = useReplayContext();
  const [timelineScale] = useTimelineScale();
  const [currentHoverTime] = useCurrentHoverTime();
  const theme = useTheme();
  const handleOnClick = useCallback(
    (params: EChartMouseEventParam<EChartMouseEventData>) => {
      console.log('onClick', {params});
    },
    []
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useTimelineScrubberMouseTracking(
    {elem: panelRef},
    timelineScale
  );

  if (!replay) {
    return <Placeholder height="60px" />;
  }

  const stackedRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions<HTMLDivElement>({elementRef: stackedRef});

  const durationMs = replay.getDurationMs();
  const startTimestampMs = replay.getStartTimestampMs();
  const chapterFrames = replay.getTimelineFrames();
  const issueFrames = replay.getErrorFrames();
  const videoEvents = replay.getVideoEvents();
  const userInteractionEvents = replay.getUserInteractionEvents();

  const frameDetails = useMemo(
    () =>
      new Map(
        chapterFrames.map(frame => [
          getGroupedCategories(frame),
          getFrameDetails(frame).colorGraphicsToken,
        ])
      ),
    [chapterFrames]
  );

  const categories = useMemo(() => frameDetails.keys().filter(Boolean), [frameDetails]);

  // Generate stacked chart data from chapter frames
  const stackedData = useMemo(() => {
    const data = categories.map(category => [
      category,
      createStackedChartData({
        bucketCount: 1000,
        frames: chapterFrames.filter(frame => getGroupedCategories(frame) === category),
        durationMs,
        startTimestampMs,
      }),
    ]);
    return Object.fromEntries(data);
  }, [chapterFrames, durationMs, startTimestampMs, categories]);

  const issuesStackedData = useMemo(
    () =>
      createStackedChartData({
        bucketCount: 1000,
        frames: issueFrames,
        durationMs,
        startTimestampMs,
      }),
    [issueFrames, durationMs, startTimestampMs]
  );

  const userInteractionStackedData = useMemo(
    () =>
      createStackedChartData({
        bucketCount: 100,
        frames: userInteractionEvents,
        durationMs,
        startTimestampMs,
      }),
    [userInteractionEvents, durationMs, startTimestampMs]
  );

  // timeline is in the middle
  const initialTranslate = 0.5 / timelineScale;
  const percentComplete = divide(currentTime, durationMs);

  const starting = percentComplete < initialTranslate;
  const ending = percentComplete + initialTranslate > 1;

  const translate = () => {
    if (starting) {
      return 0;
    }
    if (ending) {
      return initialTranslate - (1 - initialTranslate);
    }
    return initialTranslate - (currentTime > durationMs ? 1 : percentComplete);
  };

  const maxIssueCount = issuesStackedData.reduce((acc, bucket) => {
    if ((bucket.data ?? 0) > acc) {
      acc = bucket.data ?? 0;
    }
    return acc;
  }, 0);
  const maxNavigationCount = stackedData.navigation.reduce((acc, bucket) => {
    if ((bucket.data ?? 0) > acc) {
      acc = bucket.data ?? 0;
    }
    return acc;
  }, 0);
  const maxUiCount = stackedData.ui.reduce((acc, bucket) => {
    if ((bucket.data ?? 0) > acc) {
      acc = bucket.data ?? 0;
    }
    return acc;
  }, 0);

  // const ui = Object.entries(
  //   userInteractionEvents.reduce((acc, event) => {
  //     if (acc[event.timestamp]) {
  //       acc[event.timestamp] += 1;
  //     } else {
  //       acc[event.timestamp] = 1;
  //     }
  //     return acc;
  //   }, {})
  // ).map(([timestamp, value]) => [Number(timestamp), value]);

  // const chapters = chapterFrames.reduce((acc, frame) => {
  //   const category = getFrameOpOrCategory(frame);
  //   if (!category) return acc;

  //   const timestamp = frame.timestampMs || frame.startTimestampMs;

  //   if (acc[category]) {
  //     if (acc[category][timestamp]) {
  //       acc[category][timestamp] += 1;
  //     } else {
  //       acc[category][timestamp] = 1;
  //     }
  //   } else {
  //     acc[category] = {[timestamp]: 1};
  //   }
  //   return acc;
  // }, {});

  // console.log(chapters);

  const maxTotalCount = Math.max(maxIssueCount, maxNavigationCount, maxUiCount);
  // A line series for rrweb user interaction events
  const userInteractionSeries = {
    type: 'line' as const,
    gridIndex: 0,
    xAxisIndex: 0,
    yAxisIndex: 1,
    lineStyle: {
      color: theme.tokens.graphics.muted,
      opacity: 0.75,
      width: 0.4,
    },
    showSymbol: false,
    name: 'User activity',
    opacity: 0.25,
    smooth: true,
    color: theme.tokens.graphics.muted,
    data: userInteractionStackedData.map(bucket => [bucket.time, bucket.data || 0]),
  };
  const allScatterSeriesData = [
    ...issuesStackedData.map(bucket => {
      return {
        name: bucket.time,
        itemStyle: {
          color: theme.tokens.graphics.danger,
        },
        value: [bucket.time, bucket.data || 0],
      };
    }),
    ...Object.entries(stackedData).flatMap(([category, categoryData]) => {
      return categoryData.map(bucket => {
        return {
          name: category,
          itemStyle: {
            color: theme.tokens.graphics[frameDetails.get(category) ?? ''],
          },
          value: [bucket.time, bucket.data || 0],
        };
      });
    }),
  ];
  const uiSeries = {
    type: 'scatter' as const,
    singleAxisIndex: 0,
    coordinateSystem: 'singleAxis',
    showSymbol: true,
    symbolSize: (dataItem: [timestamp: number, value: number]) => {
      if (dataItem[1] === 0) {
        return 0;
      }
      // `maxIssueCount` is the max number of issues across all buckets.
      // `dataItem[1]` is the number of issues in the current bucket.
      // I want to scale the symbol size based on the number of issues in the current bucket relative to the max number of issues across all buckets.
      // I want to scale the symbol size between 4 and 16.
      return (dataItem[1] / maxTotalCount) * 16 + 4;
      // return (dataItem[1] / maxIssueCount) * 8;
    },
    seriesName: 'ui',
    name: 'ui',
    color: theme.tokens.graphics.accent,
    data: stackedData.ui.map(bucket => [bucket.time, bucket.data || 0]),
    // [
    //   ...issuesStackedData.map(bucket => {
    //     return {
    //       name: bucket.time,
    //       itemStyle: {
    //         color: theme.tokens.graphics.danger,
    //       },
    //       value: [bucket.time, bucket.data || 0],
    //     };
    //   }),
    //   ...Object.entries(stackedData).map(([category, categoryData]) => {
    //     return {
    //       name: category,
    //       itemStyle: {
    //         color: theme.tokens.graphics[frameDetails.get(category) ?? ''],
    //       },
    //       value: categoryData.map(bucket => [bucket.time, bucket.data || 0]),
    //     };
    //   }),
    // ],
  };
  const navigationSeries = {
    type: 'scatter' as const,
    singleAxisIndex: 0,
    coordinateSystem: 'singleAxis',
    showSymbol: true,
    symbolSize: (dataItem: [timestamp: number, value: number]) => {
      if (dataItem[1] === 0) {
        return 0;
      }
      // `maxIssueCount` is the max number of issues across all buckets.
      // `dataItem[1]` is the number of issues in the current bucket.
      // I want to scale the symbol size based on the number of issues in the current bucket relative to the max number of issues across all buckets.
      // I want to scale the symbol size between 4 and 16.
      return (dataItem[1] / maxTotalCount) * 16 + 4;
      // return (dataItem[1] / maxIssueCount) * 8;
    },
    seriesName: 'navigation',
    name: 'navigation',
    color: theme.tokens.graphics.success,
    data: stackedData.navigation.map(bucket => [bucket.time, bucket.data || 0]),
    // [
    //   ...issuesStackedData.map(bucket => {
    //     return {
    //       name: bucket.time,
    //       itemStyle: {
    //         color: theme.tokens.graphics.danger,
    //       },
    //       value: [bucket.time, bucket.data || 0],
    //     };
    //   }),
    //   ...Object.entries(stackedData).map(([category, categoryData]) => {
    //     return {
    //       name: category,
    //       itemStyle: {
    //         color: theme.tokens.graphics[frameDetails.get(category) ?? ''],
    //       },
    //       value: categoryData.map(bucket => [bucket.time, bucket.data || 0]),
    //     };
    //   }),
    // ],
  };
  const issueSeries = {
    type: 'scatter' as const,
    singleAxisIndex: 1,
    coordinateSystem: 'singleAxis',
    showSymbol: true,
    symbolSize: (dataItem: [timestamp: number, value: number]) => {
      if (dataItem[1] === 0) {
        return 0;
      }
      // `maxIssueCount` is the max number of issues across all buckets.
      // `dataItem[1]` is the number of issues in the current bucket.
      // I want to scale the symbol size based on the number of issues in the current bucket relative to the max number of issues across all buckets.
      // I want to scale the symbol size between 4 and 16.
      return (dataItem[1] / maxTotalCount) * 16 + 4;
      // return (dataItem[1] / maxIssueCount) * 8;
    },
    seriesName: ISSUE_CATEGORY,
    name: ISSUE_CATEGORY,
    data: issuesStackedData.map(bucket => {
      return {
        name: bucket.time,
        itemStyle: {
          color: theme.tokens.graphics.danger,
        },
        value: [bucket.time, bucket.data || 0],
      };
    }),
    // [
    //   ...issuesStackedData.map(bucket => {
    //     return {
    //       name: bucket.time,
    //       itemStyle: {
    //         color: theme.tokens.graphics.danger,
    //       },
    //       value: [bucket.time, bucket.data || 0],
    //     };
    //   }),
    //   ...Object.entries(stackedData).map(([category, categoryData]) => {
    //     return {
    //       name: category,
    //       itemStyle: {
    //         color: theme.tokens.graphics[frameDetails.get(category) ?? ''],
    //       },
    //       value: categoryData.map(bucket => [bucket.time, bucket.data || 0]),
    //     };
    //   }),
    // ],
  };

  const series =
    chapterFrames.length > 0
      ? Object.entries(stackedData).map(([category, categoryData]) => {
          const data = categoryData.map(bucket => [bucket.time, bucket.data || 0]);
          return {
            type: 'line' as const,
            smooth: true,
            xAxisIndex: 0,
            yAxisIndex: 0,
            triggerLineEvent: true,
            gridIndex: 1,
            stack: 'breadcrumbs',
            areaStyle: {
              opacity: 1,
            },
            lineStyle: {
              color: theme.tokens.graphics[frameDetails.get(category)],
              // opacity: 1,
              width: 0.4,
            },
            showSymbol: false,
            seriesName: category,
            name: category,
            opacity: 0.5,
            smooth: true,
            color: theme.tokens.graphics[frameDetails.get(category)],
            data,
          };
        })
      : [];

  const playedStatus = {
    type: 'custom' as const,
    gridIndex: 0,
    xAxisIndex: 1,
    yAxisIndex: 2,
    renderItem: () => null,
    markArea: MarkArea({
      silent: true,
      itemStyle: {
        color: theme.tokens.graphics.accent,
        opacity: 0.25,
      },
      label: {
        show: false,
      },
      data: [[{xAxis: 0}, {xAxis: startTimestampMs + currentTime}]],
    }),
    markLine: MarkLine({
      silent: true,
      lineStyle: {
        color: theme.tokens.graphics.accent,
        width: 2,
        type: 'solid',
      },
      label: {
        show: false,
      },
      data: [{xAxis: startTimestampMs + currentTime}],
      animation: false,
    }),
  };

  const hoverStatus = {
    type: 'custom' as const,
    gridIndex: 0,
    xAxisIndex: 1,
    yAxisIndex: 2,
    renderItem: () => null,
    markLine: MarkLine({
      silent: true,
      lineStyle: {
        color: theme.tokens.graphics.accent,
        width: 2,
        type: 'dotted',
      },
      label: {
        show: false,
      },
      data: currentHoverTime ? [{xAxis: startTimestampMs + currentHoverTime}] : [],
      animation: false,
    }),
  };

  return (
    <VisiblePanel ref={panelRef}>
      <Stacked
        style={{
          width: `${toPercent(timelineScale)}`,
          transform: `translate(${toPercent(translate())}, 0%)`,
        }}
        ref={stackedRef}
      >
        <MinorGridlines durationMs={durationMs} width={width} />
        <MajorGridlines durationMs={durationMs} width={width} />
        <TimelineGaps
          durationMs={durationMs}
          startTimestampMs={startTimestampMs}
          videoEvents={videoEvents}
        />
        <div>
          <BaseChart
            onClick={handleOnClick}
            height={60}
            tooltip={{appendToBody: true}}
            yAxes={[
              {
                gridIndex: 0,
                show: false,
                axisLabel: {
                  show: false,
                },
                axisTick: {
                  show: false,
                },
                axisLine: {
                  show: false,
                },
                boundaryGap: false,
              },
              {
                gridIndex: 0,
                show: false,
                axisLabel: {
                  show: false,
                },
                axisTick: {
                  show: false,
                },
                axisLine: {
                  show: false,
                },
                boundaryGap: false,
              },
              {
                gridIndex: 0,
                show: false,
                axisLabel: {
                  show: false,
                },
                axisTick: {
                  show: false,
                },
                axisLine: {
                  show: false,
                },
                boundaryGap: false,
              },
            ]}
            singleAxis={[
              {
                gridIndex: 1,
                type: 'time',
                boundaryGap: false,
                top: 0,
                left: 0,
                right: 0,
                height: 20,
                // height: 100 / 7 - 10 + '%',
                axisLine: {show: false},
                axisTick: {show: false},
                axisLabel: {
                  show: false,
                },
                min: startTimestampMs,
                max: startTimestampMs + durationMs,
              },
              {
                gridIndex: 2,
                type: 'time',
                boundaryGap: false,
                top: 20,
                left: 0,
                right: 0,
                height: 20,
                axisLine: {show: false},
                axisTick: {show: false},
                axisLabel: {show: false},
                min: startTimestampMs,
                max: startTimestampMs + durationMs,
              },
              {
                gridIndex: 0,
                type: 'time',
                boundaryGap: false,
                top: 40,
                left: 0,
                right: 0,
                height: 20,
                axisLine: {show: false},
                axisTick: {show: false},
                axisLabel: {show: false},
                min: startTimestampMs,
                max: startTimestampMs + durationMs,
              },
            ]}
            xAxes={[
              {
                gridIndex: 0,
                type: 'time',
                show: false,
                axisTick: {show: false},
                axisLine: {show: false},
                axisLabel: {
                  show: false,
                },
                splitLine: {
                  show: false,
                },
                min: startTimestampMs,
                max: startTimestampMs + durationMs,
              },
              {
                gridIndex: 0,
                type: 'time',
                show: false,
                axisTick: {show: false},
                axisLine: {show: false},
                axisLabel: {
                  show: false,
                },
                splitLine: {
                  show: false,
                },
                min: startTimestampMs,
                max: startTimestampMs + durationMs,
              },
            ]}
            grid={[
              {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
              },
              {
                left: 0,
                right: 0,
                top: 20,
                bottom: 0,
              },
              {
                left: 0,
                right: 0,
                top: 40,
                bottom: 0,
              },
            ]}
            series={[
              userInteractionSeries,
              playedStatus,
              issueSeries,
              hoverStatus,
              navigationSeries,
              uiSeries,
            ]}
          />
        </div>
      </Stacked>
    </VisiblePanel>
  );
}

const VisiblePanel = styled(Panel)`
  margin: 0;
  border: 0;
  overflow: hidden;
  background: ${p => p.theme.translucentInnerBorder};
`;
