import {useCallback, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {CallbackDataParams} from 'echarts/types/dist/shared';

import BaseChart from 'sentry/components/charts/baseChart';
import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {
  MajorGridlines,
  MinorGridlines,
} from 'sentry/components/replays/breadcrumbs/gridlines';
// import ReplayTimelineEvents from 'sentry/components/replays/breadcrumbs/replayTimelineEvents';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import TimelineGaps from 'sentry/components/replays/breadcrumbs/timelineGaps';
// import {TimelineScrubber} from 'sentry/components/replays/player/scrubber';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import type {
  EChartMouseEventData,
  EChartMouseEventParam,
  ReactEchartsRef,
} from 'sentry/types/echarts';
import divide from 'sentry/utils/number/divide';
import toPercent from 'sentry/utils/number/toPercent';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useTimelineScale from 'sentry/utils/replays/hooks/useTimelineScale';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {BreadcrumbFrame, ErrorFrame, SpanFrame} from 'sentry/utils/replays/types';
import {getFrameOpOrCategory} from 'sentry/utils/replays/types';
import {useDimensions} from 'sentry/utils/useDimensions';

// const USER_INTERACTION_CATEGORY = 'user.action';
const ISSUE_CATEGORY = 'issue';

type Frame = BreadcrumbFrame | SpanFrame;

// Helper function to create stacked area chart data from chapter frames
function createStackedChartData({
  bucketCount: _,
  durationMs,
  startTimestampMs,
  frames,
  getTimestamp = (frame: Frame) => frame.timestamp || frame.startTimestamp,
}: {
  bucketCount: number;
  durationMs: number;
  frames: unknown[];
  startTimestampMs: number;
  getTimestamp?: (frame: Frame) => number;
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
    data: [] as Frame[],
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

    if (bucketIndex >= 0 && bucketIndex < bucketCount && bucketData.at(bucketIndex)) {
      const bucketObj = bucketData.at(bucketIndex);
      if (bucketObj) {
        bucketObj.data.push(frame);
      }
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

export default function ReplayTimelineOrLoader() {
  const {replay} = useReplayContext();
  if (!replay) {
    return <Placeholder height="48px" />;
  }
  return <ReplayTimeline replay={replay} />;
}

function ReplayTimeline({replay}: {replay: ReplayReader}) {
  const {currentTime, setCurrentTime} = useReplayContext();
  const [timelineScale] = useTimelineScale();
  const [currentHoverTime] = useCurrentHoverTime();
  const theme = useTheme();

  const panelRef = useRef<HTMLDivElement>(null);
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
        bucketCount: 1000,
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
    if (bucket.data.length > acc) {
      acc = bucket.data.length;
    }
    return acc;
  }, 0);
  const maxNavigationCount = stackedData.navigation?.reduce((acc, bucket) => {
    if (bucket.data.length > acc) {
      acc = bucket.data.length;
    }
    return acc;
  }, 0);
  const maxUiCount = stackedData.ui?.reduce((acc, bucket) => {
    if (bucket.data.length > acc) {
      acc = bucket.data.length;
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
    data: userInteractionStackedData.map(bucket => [
      bucket.time,
      bucket.data.length,
      bucket.data,
    ]),
  };
  // const allScatterSeriesData = [
  //   ...issuesStackedData.map(bucket => {
  //     return {
  //       name: bucket.time,
  //       itemStyle: {
  //         color: theme.tokens.graphics.danger,
  //       },
  //       value: [bucket.time, bucket.data || 0],
  //     };
  //   }),
  //   ...Object.entries(stackedData).flatMap(([category, categoryData]) => {
  //     return categoryData.map(bucket => {
  //       return {
  //         name: category,
  //         itemStyle: {
  //           color: theme.tokens.graphics[frameDetails.get(category) ?? ''],
  //         },
  //         value: [bucket.time, bucket.data || 0],
  //       };
  //     });
  //   }),
  // ];
  const uiSeries = {
    type: 'scatter' as const,
    singleAxisIndex: 0,
    coordinateSystem: 'singleAxis',
    showSymbol: true,
    silent: true,
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
    tooltip: {show: false},
    data:
      stackedData.ui?.map(bucket => [bucket.time, bucket.data.length, bucket.data]) ?? [],
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
    silent: true,
    tooltip: {show: false},
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
    data:
      stackedData.navigation?.map(bucket => [
        bucket.time,
        bucket.data.length,
        bucket.data,
      ]) ?? [],
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
    silent: true,
    singleAxisIndex: 1,
    coordinateSystem: 'singleAxis',
    showSymbol: true,
    tooltip: {show: false},
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
        value: [bucket.time, bucket.data.length, bucket.data],
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

  // const series =
  //   chapterFrames.length > 0
  //     ? Object.entries(stackedData).map(([category, categoryData]) => {
  //         const data = categoryData.map(bucket => [bucket.time, bucket.data || 0]);
  //         return {
  //           type: 'line' as const,
  //           smooth: true,
  //           xAxisIndex: 0,
  //           yAxisIndex: 0,
  //           triggerLineEvent: true,
  //           gridIndex: 0,
  //           stack: 'breadcrumbs',
  //           areaStyle: {
  //             opacity: 1,
  //           },
  //           lineStyle: {
  //             color: theme.tokens.graphics[frameDetails.get(category)],
  //             // opacity: 1,
  //             width: 0.4,
  //           },
  //           showSymbol: false,
  //           seriesName: category,
  //           name: category,
  //           opacity: 0.5,
  //           smooth: true,
  //           color: theme.tokens.graphics[frameDetails.get(category)],
  //           data,
  //         };
  //       })
  //     : [];

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
  //
  // {
  // componentType: 'series',
  // // Series type
  // seriesType: string,
  // // Series index in option.series
  // seriesIndex: number,
  // // Series name
  // seriesName: string,
  // // Data name, or category name
  // name: string,
  // // Data index in input data array
  // dataIndex: number,
  // // Original data as input
  // data: Object,
  // // Value of data. In most series it is the same as data.
  // // But in some series it is some part of the data (e.g., in map, radar)
  // value: number|Array|Object,
  // // encoding info of coordinate system
  // // Key: coord, like ('x' 'y' 'radius' 'angle')
  // // value: Must be an array, not null/undefined. Contain dimension indices, like:
  // // {
  // //     x: [2] // values on dimension index 2 are mapped to x axis.
  // //     y: [0] // values on dimension index 0 are mapped to y axis.
  // // }
  // encode: Object,
  // // dimension names list
  // dimensionNames: Array<String>,
  // // data dimension index, for example 0 or 1 or 2 ...
  // // Only work in `radar` series.
  // dimensionIndex: number,
  // // Color of data
  // color: string,
  // // The percentage of current data item in the pie/funnel series
  // percent: number,
  // // The ancestors of current node in the sunburst series (including self)
  // treePathInfo: Array,
  // // The ancestors of current node in the tree/treemap series (including self)
  // treeAncestors: Array,
  // // A function that returns a boolean value to flag if the axis label is truncated
  // isTruncated: Function,
  // // Current index of the axis label tick
  // tickIndex: number
  // }

  const allSeries = [
    userInteractionSeries,
    playedStatus,
    issueSeries,
    hoverStatus,
    navigationSeries,
    uiSeries,
  ];

  const handleChartRef = useCallback(
    (ref: ReactEchartsRef | null) => {
      if (ref) {
        const echartsInstance = ref.getEchartsInstance?.();
        const handleClick = (params: EChartMouseEventParam<EChartMouseEventData>) => {
          const pointInPixel = [params.offsetX, params.offsetY];
          const pointInGrid = echartsInstance.convertFromPixel('grid', pointInPixel);
          if (pointInGrid?.[0]) {
            setCurrentTime(pointInGrid[0] - startTimestampMs);
          }
        };
        echartsInstance?.getZr().on('click', handleClick);
      }
    },
    [setCurrentTime, startTimestampMs]
  );

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
            ref={handleChartRef}
            height={48}
            tooltip={{
              trigger: 'axis',
              appendToBody: true,
              // @ts-expect-error Wrong typing?
              formatter: (params: CallbackDataParams[]) => {
                // This assumes all series data has same buckets, otherwise we would need to find
                // based on params.data[0] (timestamp) -- though if bucket sizes are different then this timestamp may be different too
                const dataIndex = params[0]?.dataIndex ?? 0;
                const allData = [];

                const userInteractionDataItem = userInteractionSeries.data.at(dataIndex);

                if (userInteractionDataItem) {
                  allData.push(
                    `<div>user activity:${userInteractionDataItem[1]} events</div>`
                  );
                }

                const navigationDataItem = navigationSeries.data.at(dataIndex);
                const issueDataItem = issueSeries.data.at(dataIndex);
                const uiDataItem = uiSeries.data.at(dataIndex);

                if (navigationDataItem) {
                  navigationDataItem[2].forEach((frame: SpanFrame) => {
                    allData.push(`<div>${frame.op}: ${frame.description}</div>`);
                  });
                }

                if (issueDataItem) {
                  issueDataItem.value?.[2]?.forEach((frame: ErrorFrame) => {
                    allData.push(`<div>Error: ${frame.message}</div>`);
                  });
                }

                if (uiDataItem) {
                  uiDataItem[2].forEach((frame: BreadcrumbFrame) => {
                    allData.push(`<div>${frame.category}: ${frame.message}</div>`);
                  });
                }

                allData.push(params[0].data[0]);

                // const foundSeries = allSeries
                //   .map(series => {
                //     const dataItem = series.data?.at(params[0]?.dataIndex);
                //     if (dataItem) {
                //       return (dataItem.value ?? dataItem)?.[2];
                //     }
                //   })
                //   .filter(Boolean);
                // const str = foundSeries
                //   .flatMap(series => {
                //     return series
                //       .map(frame => {
                //         return `<div>${frame.message}</div>`;
                //       })
                //       .join('\n');
                //   })
                //   .join('\n');
                // console.log({str});
                return allData.join('\n');
              },
            }}
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
            series={allSeries}
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
