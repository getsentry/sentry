import {useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {AreaChart} from 'sentry/components/charts/areaChart';
import BaseChart from 'sentry/components/charts/baseChart';
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
import divide from 'sentry/utils/number/divide';
import toPercent from 'sentry/utils/number/toPercent';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useTimelineScale from 'sentry/utils/replays/hooks/useTimelineScale';
import type {incrementalSnapshotEvent} from 'sentry/utils/replays/types';
import {getFrameOpOrCategory} from 'sentry/utils/replays/types';
import {useDimensions} from 'sentry/utils/useDimensions';

// Helper function to create stacked area chart data from chapter frames
function createStackedChartData(
  chapterFrames: any[],
  userInteractionEvents: incrementalSnapshotEvent[],
  durationMs: number,
  startTimestampMs: number
) {
  console.log({userInteractionEvents});
  if (!chapterFrames.length && !userInteractionEvents.length) {
    return [];
  }

  // Create time buckets (e.g., every 1% of the duration)
  const bucketCount = 100;
  const bucketSizeMs = durationMs / bucketCount;

  // Get unique categories
  const categories = [
    ...new Set([
      ...chapterFrames.map(frame => getFrameOpOrCategory(frame)),
      'user.action',
    ]),
  ].filter(Boolean);

  // Initialize buckets
  const buckets = Array.from({length: bucketCount}, (_, index) => {
    const bucketData: Record<string, any> = {
      name: startTimestampMs + index * bucketSizeMs,
      time: startTimestampMs + index * bucketSizeMs,
      data: {},
    };

    // Initialize all categories to 0
    categories.forEach(category => {
      bucketData.data[category] = 0;
    });

    return bucketData;
  });

  // Count frames per category per bucket
  chapterFrames.forEach(frame => {
    const category = getFrameOpOrCategory(frame);
    if (!category || (!frame.timestamp && !frame.startTimestamp)) return;

    const frameTimeMs = (frame.timestamp || frame.startTimestamp) - startTimestampMs;
    const bucketIndex = Math.floor(frameTimeMs / bucketSizeMs);

    if (bucketIndex >= 0 && bucketIndex < bucketCount) {
      buckets[bucketIndex].data[category] += 1;
    }
  });

  userInteractionEvents.forEach(event => {
    const category = 'user.action';
    if (!category || !event.timestamp) return;

    const eventTimeMs = event.timestamp - startTimestampMs;
    const bucketIndex = Math.floor(eventTimeMs / bucketSizeMs);

    if (bucketIndex >= 0 && bucketIndex < bucketCount) {
      buckets[bucketIndex].data[category] += 1;
    }
  });

  return buckets;
}

export default function ReplayTimeline() {
  const {replay, currentTime} = useReplayContext();
  const [timelineScale] = useTimelineScale();
  const theme = useTheme();

  const panelRef = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useTimelineScrubberMouseTracking(
    {elem: panelRef},
    timelineScale
  );

  const stackedRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions<HTMLDivElement>({elementRef: stackedRef});

  if (!replay) {
    return <Placeholder height="20px" />;
  }

  const durationMs = replay.getDurationMs();
  const startTimestampMs = replay.getStartTimestampMs();
  const chapterFrames = replay.getChapterFrames();
  const videoEvents = replay.getVideoEvents();
  const userInteractionEvents = replay.getUserInteractionEvents();

  // Generate stacked chart data from chapter frames
  const stackedData = useMemo(
    () =>
      createStackedChartData(
        chapterFrames,
        userInteractionEvents,
        durationMs,
        startTimestampMs
      ),
    [chapterFrames, userInteractionEvents, durationMs, startTimestampMs]
  );
  console.log({stackedData});

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

  const frameDetails = new Map([
    ...chapterFrames.map(frame => [
      getFrameOpOrCategory(frame),
      getFrameDetails(frame).colorGraphicsToken,
    ]),
    ['user.action', 'muted'],
  ]);
  const chapterByCategory = useMemo(() => {
    return chapterFrames.reduce(
      (acc, frame) => {
        const category = getFrameOpOrCategory(frame);
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(frame);
        return acc;
      },
      {} as Record<string, Array<BreadcrumbFrame | SpanFrame>>
    );
  }, [chapterFrames]);

  const series =
    chapterFrames.length > 0
      ? Object.entries(chapterByCategory).map(([category, frames]) => ({
          type: 'area',
          seriesName: category,
          smooth: true,
          stack: true,
          name: category,
          color: theme.tokens.graphics[frameDetails.get(category)],
          yAxisIndex: 0,

          // areaStyle: {
          //   color: theme.tokens.graphics[category],
          // },
          // data: frames.map(frame => [+frame.timestamp || +frame.startTimestamp, 1]),
          data: frames.map(frame => ({
            name: +(frame.timestamp || frame.startTimestamp),
            value: 1,
          })),
        }))
      : [];

  const [maxIssueCount, maxOtherCount] = stackedData.reduce<[number, number]>(
    (acc, bucket) => {
      if ((bucket.data.issue ?? 0) > acc[0]) {
        acc[0] = bucket.data.issue ?? 0;
      }
      const nonIssueTotal = Object.entries<number>(bucket.data)
        .filter(([category]) => category !== 'issue' && category !== 'user.action')
        .reduce((sum, [, value]) => {
          return sum + (value ?? 0);
        }, 0);

      if (nonIssueTotal > acc[1]) {
        acc[1] = nonIssueTotal;
      }
      return acc;
    },
    [0, 0]
  );

  console.log({maxIssueCount, maxOtherCount});
  chapterByCategory['user.action'] = userInteractionEvents;

  const series1 =
    chapterFrames.length > 0
      ? [
          ...new Set(chapterFrames.map(frame => getFrameOpOrCategory(frame))),
          'user.action',
        ]
          .filter(Boolean)
          .map(category => {
            if (category === 'issue') {
              const data = {
                type: 'scatter',
                xAxisIndex: 1,
                // singleAxisIndex: 0,
                // coordinateSystem: 'singleAxis',
                showSymbol: true,
                symbolSize: dataItem => {
                  if (dataItem[2] === 0) {
                    return 0;
                  }
                  // `maxIssueCount` is the max number of issues across all buckets.
                  // `dataItem[1]` is the number of issues in the current bucket.
                  // I want to scale the symbol size based on the number of issues in the current bucket relative to the max number of issues across all buckets.
                  // I want to scale the symbol size between 4 and 16.
                  return (dataItem[2] / maxIssueCount) * 12 + 4;
                  // return (dataItem[1] / maxIssueCount) * 8;
                },
                // areaStyle: {
                //   opacity: category === 'issue' ? 1 : 0.5,
                // },
                seriesName: category,
                name: category,
                // opacity: category === 'issue' ? 1 : 0.5,
                smooth: true,
                color: theme.tokens.graphics[frameDetails.get(category)],
                data: stackedData.map(bucket => [
                  bucket.time,
                  maxOtherCount + 4,
                  bucket.data[category] || 0,
                ]),
                // data: stackedData.map(bucket => ({
                //   color: theme.tokens.graphics[frameDetails.get(category)],
                //   opacity: category === 'issue' ? 1 : 0.5,
                //   name: bucket.time,
                //   value: bucket[category] || 0,
                // })),
              };
              console.log({data});
              return data;
            }
            if (category === 'user.action') {
              return {
                type: 'line',
                xAxisIndex: 0,
                yAxisIndex: 1,
                // stack: 'user.activity',
                // areaStyle: {
                //   // opacity: 1,
                // },
                lineStyle: {
                  color: theme.tokens.graphics[frameDetails.get(category)],
                  opacity: 0.75,
                  // opacity: 1,
                  width: 0.4,
                },
                showSymbol: false,
                seriesName: category,
                name: category,
                opacity: 0.25,
                smooth: true,
                color: theme.tokens.graphics[frameDetails.get(category)],
                // data: stackedData.map(bucket => ({
                //   name: bucket.time,
                //   value: bucket[category] || 0,
                // })),
                data: stackedData.map(bucket => [
                  bucket.time,
                  bucket.data[category] || 0,
                ]),
              };
            }

            return {
              type: 'line',
              xAxisIndex: 0,
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
              opacity: category === 'issue' ? 1 : 0.5,
              smooth: true,
              color: theme.tokens.graphics[frameDetails.get(category)],
              // data: stackedData.map(bucket => ({
              //   name: bucket.time,
              //   value: bucket[category] || 0,
              // })),
              data: stackedData.map(bucket => [bucket.time, bucket.data[category] || 0]),
            };
          })
      : [];

  console.log({chapterFrames, chapterByCategory, frameDetails, stackedData, series});
  return (
    <VisiblePanel ref={panelRef} {...mouseTrackingProps}>
      <Stacked
        style={{
          width: `${toPercent(timelineScale)}`,
          transform: `translate(${toPercent(translate())}, 0%)`,
        }}
        ref={stackedRef}
      >
        <MinorGridlines durationMs={durationMs} width={width} />
        <MajorGridlines durationMs={durationMs} width={width} />
        <TimelineScrubber />
        <TimelineGaps
          durationMs={durationMs}
          startTimestampMs={startTimestampMs}
          videoEvents={videoEvents}
        />
        <div>
          <BaseChart
            stacked
            height={16}
            tooltip={{appendToBody: true}}
            yAxes={[
              {
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
            xAxes={[
              {
                boundaryGap: false,
                axisTick: {show: false},
                axisLine: {show: false},
                axisLabel: {
                  show: false,
                },
                splitLine: {
                  show: false,
                  lineStyle: {color: 'rgba(24, 20, 35, 0.05)'},
                },
              },
              {
                boundaryGap: false,
                axisTick: {show: false},
                axisLine: {show: false, onZero: false},
                axisLabel: {
                  show: false,
                },
                splitLine: {
                  show: false,
                },
              },
            ]}
            grid={{
              left: 0,
              right: 0,
              top: 8,
              bottom: 0,
            }}
            series={[
              ...series1.filter(s => s.seriesName === 'issue'),
              // ...series1.filter(s => s.seriesName !== 'issue'),
            ]}
          />
          <BaseChart
            stacked
            height={36}
            tooltip={{appendToBody: true}}
            yAxes={[
              {
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
            xAxes={[
              {
                boundaryGap: false,
                axisTick: {show: false},
                axisLine: {show: false},
                axisLabel: {
                  show: false,
                },
                splitLine: {
                  show: false,
                  lineStyle: {color: 'rgba(24, 20, 35, 0.05)'},
                },
              },
              {
                boundaryGap: false,
                axisTick: {show: false},
                axisLine: {show: false, onZero: false},
                axisLabel: {
                  show: false,
                },
                splitLine: {
                  show: false,
                },
              },
            ]}
            grid={{
              left: 0,
              right: 0,
              top: 8,
              bottom: 0,
            }}
            series={[
              // ...series1.filter(s => s.seriesName === 'issue'),
              ...series1.filter(s => s.seriesName !== 'issue'),
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

const TimelineEventsContainer = styled('div')`
  padding-top: 10px;
  padding-bottom: 10px;
`;
