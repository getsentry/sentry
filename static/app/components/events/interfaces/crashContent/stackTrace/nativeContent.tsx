import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import NativeFrame from 'sentry/components/events/interfaces/nativeFrame';
import {
  findImageForAddress,
  getHiddenFrameIndices,
  getLastFrameIndex,
  isRepeatedFrame,
  parseAddress,
  stackTracePlatformIcon,
} from 'sentry/components/events/interfaces/utils';
import Panel from 'sentry/components/panels/panel';
import type {Event, Frame} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';

import {OmittedFrames} from './omittedFrames';
import StacktracePlatformIcon from './platformIcon';

function isFrameUsedForGrouping(
  frame: Frame,
  groupingCurrentLevel: Group['metadata']['current_level']
): boolean {
  const {minGroupingLevel} = frame;

  if (groupingCurrentLevel === undefined || minGroupingLevel === undefined) {
    return false;
  }

  return minGroupingLevel <= groupingCurrentLevel;
}

type Props = {
  data: StacktraceType;
  event: Event;
  newestFirst: boolean;
  platform: PlatformKey;
  className?: string;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideIcon?: boolean;
  includeSystemFrames?: boolean;
  inlined?: boolean;
  isHoverPreviewed?: boolean;
  maxDepth?: number;
  meta?: Record<any, any>;
};

export function NativeContent({
  className,
  data,
  platform,
  event,
  newestFirst,
  isHoverPreviewed,
  inlined,
  hideIcon,
  groupingCurrentLevel,
  includeSystemFrames = true,
  maxDepth,
  meta,
}: Props) {
  const frames = data.frames ?? [];

  const isDartAsyncSuspensionFrame = useCallback((frame: Frame): boolean => {
    return (
      frame.filename === '<asynchronous suspension>' ||
      frame.absPath === '<asynchronous suspension>'
    );
  }, []);

  const frameIsVisible = useCallback(
    (frame: Frame, nextFrame: Frame) => {
      if (!includeSystemFrames && isDartAsyncSuspensionFrame(frame)) {
        return false;
      }

      return (
        includeSystemFrames ||
        frame.inApp ||
        nextFrame?.inApp ||
        // the last non-app frame
        (!frame.inApp && !nextFrame) ||
        isFrameUsedForGrouping(frame, groupingCurrentLevel)
      );
    },
    [includeSystemFrames, groupingCurrentLevel, isDartAsyncSuspensionFrame]
  );

  function setInitialFrameMap(): Record<number, boolean> {
    const indexMap: Record<number, boolean> = {};
    frames.forEach((frame, frameIdx) => {
      const nextFrame = frames[frameIdx + 1]!;
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);
      if (frameIsVisible(frame, nextFrame) && !repeatedFrame && !frame.inApp) {
        indexMap[frameIdx] = false;
      }
    });
    return indexMap;
  }

  const [toggleFrameMap, setToggleFrameMap] = useState(() => setInitialFrameMap());

  function getInitialFrameCounts(): Record<number, number> {
    let count = 0;
    const countMap: Record<number, number> = {};
    frames.forEach((frame, frameIdx) => {
      const nextFrame = (data.frames ?? [])[frameIdx + 1]!;
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);
      if (frameIsVisible(frame, nextFrame) && !repeatedFrame && !frame.inApp) {
        countMap[frameIdx] = count;
        count = 0;
      } else {
        if (!repeatedFrame && !frame.inApp) {
          count += 1;
        }
      }
    });
    return countMap;
  }

  const handleToggleFrames = (
    mouseEvent: React.MouseEvent<HTMLElement>,
    frameIndex: number
  ) => {
    mouseEvent.stopPropagation(); // to prevent toggling frame context

    setToggleFrameMap(prevState => ({
      ...prevState,
      [frameIndex]: !prevState[frameIndex],
    }));
  };

  const lastFrameIndex = getLastFrameIndex(frames);
  const frameCountMap = getInitialFrameCounts();
  const hiddenFrameIndices: number[] = getHiddenFrameIndices({
    data,
    toggleFrameMap,
    frameCountMap,
  });

  const maxLengthOfAllRelativeAddresses = frames.reduce(
    (maxLengthUntilThisPoint, frame) => {
      const correspondingImage = findImageForAddress({
        event,
        addrMode: frame.addrMode,
        address: frame.instructionAddr,
      });

      try {
        const relativeAddress = (
          parseAddress(frame.instructionAddr) -
          parseAddress(correspondingImage.image_addr)
        ).toString(16);

        return maxLengthUntilThisPoint > relativeAddress.length
          ? maxLengthUntilThisPoint
          : relativeAddress.length;
      } catch {
        return maxLengthUntilThisPoint;
      }
    },
    0
  );

  const firstInAppFrameIndex = frames[newestFirst ? 'findLastIndex' : 'findIndex'](
    frame => frame.inApp
  );
  let convertedFrames = frames
    .map((frame, frameIndex) => {
      const prevFrame = frames[frameIndex - 1];
      const nextFrame = frames[frameIndex + 1]!;
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);
      const isLastFrame = frameIndex === frames.length - 1;

      if (
        (frameIsVisible(frame, nextFrame) && !repeatedFrame) ||
        hiddenFrameIndices.includes(frameIndex)
      ) {
        const frameProps: React.ComponentProps<typeof NativeFrame> = {
          event,
          frame,
          prevFrame,
          nextFrame,
          emptySourceNotation: inlined
            ? false
            : lastFrameIndex === frameIndex && frameIndex === 0,
          platform,
          onShowFramesToggle: (e: React.MouseEvent<HTMLElement>) => {
            handleToggleFrames(e, frameIndex);
          },
          image: findImageForAddress({
            event,
            addrMode: frame.addrMode,
            address: frame.instructionAddr,
          }),
          maxLengthOfRelativeAddress: maxLengthOfAllRelativeAddresses,
          registers: isLastFrame ? data.registers : null,
          hiddenFrameCount: frameCountMap[frameIndex],
          isHoverPreviewed,
          isShowFramesToggleExpanded: toggleFrameMap[frameIndex] ?? false,
          isSubFrame: hiddenFrameIndices.includes(frameIndex),
          isFirstInAppFrame: firstInAppFrameIndex === frameIndex,
          isUsedForGrouping: isFrameUsedForGrouping(frame, groupingCurrentLevel),
          frameMeta: meta?.frames?.[frameIndex],
          registersMeta: meta?.registers,
        };

        if (frameIndex === data.framesOmitted?.[0]) {
          return (
            <Fragment key={frameIndex}>
              <NativeFrame {...frameProps} />
              <OmittedFrames omittedFrames={data.framesOmitted} />
            </Fragment>
          );
        }

        return <NativeFrame key={frameIndex} {...frameProps} />;
      }

      if (frameIndex !== data.framesOmitted?.[0]) {
        return null;
      }

      return <OmittedFrames key={frameIndex} omittedFrames={data.framesOmitted} />;
    })
    .filter((frame): frame is React.ReactElement => !!frame);

  if (defined(maxDepth)) {
    convertedFrames = convertedFrames.slice(-maxDepth);
  }
  if (newestFirst) {
    convertedFrames = convertedFrames.toReversed();
  }

  const wrapperClassName = `traceback ${
    includeSystemFrames ? 'full-traceback' : 'in-app-traceback'
  } ${className}`;

  return (
    <Wrapper>
      {hideIcon ? null : (
        <StacktracePlatformIcon
          platform={stackTracePlatformIcon(platform, data.frames ?? [])}
        />
      )}
      <ContentPanel
        className={wrapperClassName}
        data-test-id="native-stack-trace-content"
        hideIcon={hideIcon}
      >
        <Frames data-test-id="stack-trace">{convertedFrames}</Frames>
      </ContentPanel>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: relative;
`;

const ContentPanel = styled(Panel)<{hideIcon?: boolean}>`
  position: relative;
  border-top-left-radius: ${p => (p.hideIcon ? p.theme.radius.md : 0)};
  overflow: hidden;
`;

const Frames = styled('ul')`
  list-style: none;
`;
