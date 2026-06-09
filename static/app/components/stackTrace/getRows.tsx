import {isRepeatedFrame} from 'sentry/components/events/interfaces/utils';
import {
  DEFAULT_STACK_TRACE_ROW_POLICY,
  type StackTraceRowPolicy,
} from 'sentry/components/stackTrace/rowPolicy';
import type {FrameRow, OmittedFramesRow, Row} from 'sentry/components/stackTrace/types';
import type {Frame} from 'sentry/types/event';

function frameIsVisible(
  frame: Frame,
  nextFrame: Frame | undefined,
  includeSystemFrames: boolean,
  rowPolicy: StackTraceRowPolicy
) {
  return rowPolicy.isFrameVisible({
    frame,
    includeSystemFrames,
    nextFrame,
  });
}

export function createInitialHiddenFrameToggleMap(
  frames: Frame[],
  includeSystemFrames: boolean,
  rowPolicy = DEFAULT_STACK_TRACE_ROW_POLICY
) {
  const indexMap: Record<number, boolean> = {};

  frames.forEach((frame, frameIdx) => {
    const nextFrame = frames[frameIdx + 1];
    const repeatedFrame = isRepeatedFrame(frame, nextFrame);

    if (
      frameIsVisible(frame, nextFrame, includeSystemFrames, rowPolicy) &&
      !repeatedFrame &&
      !frame.inApp
    ) {
      indexMap[frameIdx] = false;
    }
  });

  return indexMap;
}

export function getFrameCountMap(
  frames: Frame[],
  includeSystemFrames: boolean,
  rowPolicy = DEFAULT_STACK_TRACE_ROW_POLICY
) {
  let count = 0;
  const countMap: Record<number, number> = {};

  frames.forEach((frame, frameIdx) => {
    const nextFrame = frames[frameIdx + 1];
    const repeatedFrame = isRepeatedFrame(frame, nextFrame);

    if (
      frameIsVisible(frame, nextFrame, includeSystemFrames, rowPolicy) &&
      !repeatedFrame &&
      !frame.inApp
    ) {
      countMap[frameIdx] = count;
      count = 0;
    } else if (!repeatedFrame && !frame.inApp) {
      count += 1;
    }
  });

  return countMap;
}

function getHiddenFrameIndices({
  frames,
  hiddenFrameToggleMap,
  frameCountMap,
}: {
  frameCountMap: Record<number, number>;
  frames: Frame[];
  hiddenFrameToggleMap: Record<number, boolean>;
}) {
  const repeatedIndices = new Set<number>();

  frames.forEach((frame, frameIdx) => {
    const nextFrame = frames[frameIdx + 1];
    if (isRepeatedFrame(frame, nextFrame)) {
      repeatedIndices.add(frameIdx);
    }
  });

  const hiddenFrameIndices = new Set<number>();

  Object.entries(hiddenFrameToggleMap).forEach(([indexString, isExpanded]) => {
    if (!isExpanded) {
      return;
    }

    const index = Number(indexString);
    let i = 1;
    let numHidden = frameCountMap[index] ?? 0;

    while (numHidden > 0) {
      if (!repeatedIndices.has(index - i)) {
        hiddenFrameIndices.add(index - i);
        numHidden -= 1;
      }
      i += 1;
    }
  });

  return hiddenFrameIndices;
}

export function getRows({
  frames,
  includeSystemFrames,
  hiddenFrameToggleMap,
  frameCountMap,
  newestFirst,
  framesOmitted,
  maxDepth,
  rowPolicy = DEFAULT_STACK_TRACE_ROW_POLICY,
}: {
  frameCountMap: Record<number, number>;
  frames: Frame[];
  framesOmitted: [number, number] | null | undefined;
  hiddenFrameToggleMap: Record<number, boolean>;
  includeSystemFrames: boolean;
  newestFirst: boolean;
  maxDepth?: number;
  rowPolicy?: StackTraceRowPolicy;
}): Row[] {
  const hiddenFrameIndices = getHiddenFrameIndices({
    frames,
    hiddenFrameToggleMap,
    frameCountMap,
  });

  let nRepeats = 0;

  let rows = frames
    .map((frame, frameIndex) => {
      const nextFrame = frames[frameIndex + 1];
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);

      if (repeatedFrame) {
        nRepeats += 1;
      }

      if (
        (frameIsVisible(frame, nextFrame, includeSystemFrames, rowPolicy) &&
          !repeatedFrame) ||
        hiddenFrameIndices.has(frameIndex)
      ) {
        const row: FrameRow = {
          kind: 'frame',
          frame,
          frameIndex,
          nextFrame,
          timesRepeated: nRepeats,
          isUsedForGrouping: rowPolicy.isFrameUsedForGrouping(frame),
          isSubFrame: hiddenFrameIndices.has(frameIndex),
          hiddenFrameCount: frameCountMap[frameIndex],
        };

        nRepeats = 0;

        if (frameIndex === framesOmitted?.[0]) {
          return [
            row,
            {
              kind: 'omitted',
              omittedFrames: framesOmitted,
              rowKey: `omitted-${framesOmitted[0]}-${framesOmitted[1]}`,
            } satisfies OmittedFramesRow,
          ];
        }

        return row;
      }

      if (!repeatedFrame) {
        nRepeats = 0;
      }

      if (frameIndex !== framesOmitted?.[0]) {
        return null;
      }

      return {
        kind: 'omitted',
        omittedFrames: framesOmitted,
        rowKey: `omitted-${framesOmitted[0]}-${framesOmitted[1]}`,
      } satisfies OmittedFramesRow;
    })
    .flatMap((row): Row[] => {
      if (!row) {
        return [];
      }
      return Array.isArray(row) ? row : [row];
    });

  if (maxDepth !== undefined) {
    rows = rows.slice(-maxDepth);
  }

  return newestFirst ? [...rows].reverse() : rows;
}
