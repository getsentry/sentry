import type {Frame} from 'sentry/types/event';

interface StackTraceFrameVisibilityContext {
  frame: Frame;
  includeSystemFrames: boolean;
  nextFrame: Frame | undefined;
}

export interface StackTraceRowPolicy {
  isFrameUsedForGrouping: (frame: Frame) => boolean;
  isFrameVisible: (context: StackTraceFrameVisibilityContext) => boolean;
}

function isDefaultFrameVisible({
  frame,
  includeSystemFrames,
  nextFrame,
}: StackTraceFrameVisibilityContext) {
  return (
    includeSystemFrames ||
    frame.inApp ||
    nextFrame?.inApp ||
    // Include the last non-app frame to keep the call chain understandable.
    (!frame.inApp && !nextFrame)
  );
}

export const DEFAULT_STACK_TRACE_ROW_POLICY: StackTraceRowPolicy = {
  isFrameUsedForGrouping: () => false,
  isFrameVisible: isDefaultFrameVisible,
};

function isDartAsyncSuspensionFrame(frame: Frame) {
  return (
    frame.filename === '<asynchronous suspension>' ||
    frame.absPath === '<asynchronous suspension>'
  );
}

function createGroupingMatcher(groupingCurrentLevel?: number) {
  return (frame: Frame) => {
    const {minGroupingLevel} = frame;

    if (groupingCurrentLevel === undefined || minGroupingLevel === undefined) {
      return false;
    }

    return minGroupingLevel <= groupingCurrentLevel;
  };
}

export function createStackTraceRowPolicy({
  groupingCurrentLevel,
  hideDartAsyncSuspensionFrames = false,
}: {
  groupingCurrentLevel?: number;
  hideDartAsyncSuspensionFrames?: boolean;
}): StackTraceRowPolicy {
  const isFrameUsedForGrouping = createGroupingMatcher(groupingCurrentLevel);

  return {
    isFrameUsedForGrouping,
    isFrameVisible(context) {
      if (
        !context.includeSystemFrames &&
        hideDartAsyncSuspensionFrames &&
        isDartAsyncSuspensionFrame(context.frame)
      ) {
        return false;
      }

      return isDefaultFrameVisible(context) || isFrameUsedForGrouping(context.frame);
    },
  };
}
