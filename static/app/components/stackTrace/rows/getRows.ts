import type {Frame} from 'sentry/types/event';

type FrameRow = {
  frame: Frame;
  frameIndex: number;
  hiddenFrameCount: number | undefined;
  isSubFrame: boolean;
  kind: 'frame';
  nextFrame: Frame | undefined;
  timesRepeated: number;
};

type OmittedFramesRow = {
  kind: 'omitted';
  omittedFrames: [number, number];
  rowKey: string;
};

type Row = FrameRow | OmittedFramesRow;

function isRepeatedFrame(frame: Frame, nextFrame?: Frame) {
  if (!nextFrame) {
    return false;
  }

  return (
    frame.lineNo === nextFrame.lineNo &&
    frame.instructionAddr === nextFrame.instructionAddr &&
    frame.package === nextFrame.package &&
    frame.module === nextFrame.module &&
    frame.function === nextFrame.function
  );
}

function frameIsVisible(
  frame: Frame,
  nextFrame: Frame | undefined,
  includeSystemFrames: boolean
) {
  return (
    includeSystemFrames ||
    frame.inApp ||
    nextFrame?.inApp ||
    // Include the last non-app frame to keep the call chain understandable.
    (!frame.inApp && !nextFrame)
  );
}

export function getLastFrameIndex(frames: Frame[]) {
  const inAppFrameIndexes = frames
    .map((frame, frameIndex) => {
      if (frame.inApp) {
        return frameIndex;
      }
      return undefined;
    })
    .filter((frame): frame is number => frame !== undefined);

  return inAppFrameIndexes.length
    ? inAppFrameIndexes[inAppFrameIndexes.length - 1]!
    : frames.length - 1;
}

export function createInitialHiddenFrameToggleMap(
  frames: Frame[],
  includeSystemFrames: boolean
) {
  const indexMap: Record<number, boolean> = {};

  frames.forEach((frame, frameIdx) => {
    const nextFrame = frames[frameIdx + 1];
    const repeatedFrame = isRepeatedFrame(frame, nextFrame);

    if (
      frameIsVisible(frame, nextFrame, includeSystemFrames) &&
      !repeatedFrame &&
      !frame.inApp
    ) {
      indexMap[frameIdx] = false;
    }
  });

  return indexMap;
}

export function getFrameCountMap(frames: Frame[], includeSystemFrames: boolean) {
  let count = 0;
  const countMap: Record<number, number> = {};

  frames.forEach((frame, frameIdx) => {
    const nextFrame = frames[frameIdx + 1];
    const repeatedFrame = isRepeatedFrame(frame, nextFrame);

    if (
      frameIsVisible(frame, nextFrame, includeSystemFrames) &&
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
  const repeatedIndices: number[] = [];

  frames.forEach((frame, frameIdx) => {
    const nextFrame = frames[frameIdx + 1];
    if (isRepeatedFrame(frame, nextFrame)) {
      repeatedIndices.push(frameIdx);
    }
  });

  let hiddenFrameIndices: number[] = [];

  Object.keys(hiddenFrameToggleMap)
    .filter(frameIndex => hiddenFrameToggleMap[Number(frameIndex)] === true)
    .forEach(indexString => {
      const index = Number(indexString);
      const indicesToBeAdded: number[] = [];

      let i = 1;
      let numHidden = frameCountMap[index] ?? 0;

      while (numHidden > 0) {
        if (!repeatedIndices.includes(index - i)) {
          indicesToBeAdded.push(index - i);
          numHidden -= 1;
        }
        i += 1;
      }

      hiddenFrameIndices = [...hiddenFrameIndices, ...indicesToBeAdded];
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
}: {
  frameCountMap: Record<number, number>;
  frames: Frame[];
  framesOmitted: [number, number] | null | undefined;
  hiddenFrameToggleMap: Record<number, boolean>;
  includeSystemFrames: boolean;
  maxDepth: number | undefined;
  newestFirst: boolean;
}): Row[] {
  const hiddenFrameIndices = getHiddenFrameIndices({
    frames,
    hiddenFrameToggleMap,
    frameCountMap,
  });

  let nRepeats = 0;

  let rows: Row[] = frames
    .map((frame, frameIndex) => {
      const nextFrame = frames[frameIndex + 1];
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);

      if (repeatedFrame) {
        nRepeats += 1;
      }

      if (
        (frameIsVisible(frame, nextFrame, includeSystemFrames) && !repeatedFrame) ||
        hiddenFrameIndices.includes(frameIndex)
      ) {
        const row: FrameRow = {
          kind: 'frame',
          frame,
          frameIndex,
          nextFrame,
          timesRepeated: nRepeats,
          isSubFrame: hiddenFrameIndices.includes(frameIndex),
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
    .filter((row): row is Row | Row[] => !!row)
    .flat();

  if (maxDepth !== undefined) {
    rows = rows.slice(-maxDepth);
  }

  return newestFirst ? [...rows].reverse() : rows;
}
