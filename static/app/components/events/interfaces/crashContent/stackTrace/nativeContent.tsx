import {cloneElement, Fragment, useState} from 'react';
import styled from '@emotion/styled';

import StacktracePlatformIcon from 'sentry/components/events/interfaces/crashContent/stackTrace/platformIcon';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import type {Event, Frame} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';

import NativeFrame from '../../nativeFrame';
import {
  findImageForAddress,
  getHiddenFrameIndices,
  getLastFrameIndex,
  isRepeatedFrame,
  parseAddress,
  stackTracePlatformIcon,
} from '../../utils';

type Props = {
  data: StacktraceType;
  event: Event;
  platform: PlatformKey;
  className?: string;
  expandFirstFrame?: boolean;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hiddenFrameCount?: number;
  hideIcon?: boolean;
  includeSystemFrames?: boolean;
  inlined?: boolean;
  isHoverPreviewed?: boolean;
  isShowFramesToggleExpanded?: boolean;
  isSubFrame?: boolean;
  maxDepth?: number;
  meta?: Record<any, any>;
  newestFirst?: boolean;
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
  expandFirstFrame = true,
  maxDepth,
  meta,
}: Props) {
  const [showingAbsoluteAddresses, setShowingAbsoluteAddresses] = useState(false);
  const [showCompleteFunctionName, setShowCompleteFunctionName] = useState(false);
  const [toggleFrameMap, setToggleFrameMap] = useState(setInitialFrameMap());

  const {frames = [], framesOmitted, registers} = data;

  function frameIsVisible(frame: Frame, nextFrame: Frame) {
    return (
      includeSystemFrames ||
      frame.inApp ||
      nextFrame?.inApp ||
      // the last non-app frame
      (!frame.inApp && !nextFrame) ||
      isFrameUsedForGrouping(frame)
    );
  }

  function setInitialFrameMap(): {[frameIndex: number]: boolean} {
    const indexMap = {};
    (data.frames ?? []).forEach((frame, frameIdx) => {
      const nextFrame = (data.frames ?? [])[frameIdx + 1]!;
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);
      if (frameIsVisible(frame, nextFrame) && !repeatedFrame && !frame.inApp) {
        indexMap[frameIdx] = false;
      }
    });
    return indexMap;
  }

  function getInitialFrameCounts(): {[frameIndex: number]: number} {
    let count = 0;
    const countMap = {};
    (data.frames ?? []).forEach((frame, frameIdx) => {
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

  function isFrameUsedForGrouping(frame: Frame) {
    const {minGroupingLevel} = frame;

    if (groupingCurrentLevel === undefined || minGroupingLevel === undefined) {
      return false;
    }

    return minGroupingLevel <= groupingCurrentLevel;
  }

  function handleToggleAddresses(mouseEvent: React.MouseEvent<SVGElement>) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible
    setShowingAbsoluteAddresses(!showingAbsoluteAddresses);
  }

  function handleToggleFunctionName(mouseEvent: React.MouseEvent<SVGElement>) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible
    setShowCompleteFunctionName(!showCompleteFunctionName);
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

  function renderOmittedFrames(firstFrameOmitted: any, lastFrameOmitted: any) {
    return t(
      'Frames %d until %d were omitted and not available.',
      firstFrameOmitted,
      lastFrameOmitted
    );
  }

  const firstFrameOmitted = framesOmitted?.[0] ?? null;
  const lastFrameOmitted = framesOmitted?.[1] ?? null;
  const lastFrameIndex = getLastFrameIndex(frames);
  const frameCountMap = getInitialFrameCounts();
  const hiddenFrameIndices: number[] = getHiddenFrameIndices({
    data,
    toggleFrameMap,
    frameCountMap,
  });

  let nRepeats = 0;

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

  let convertedFrames = frames
    .map((frame, frameIndex) => {
      const prevFrame = frames[frameIndex - 1];
      const nextFrame = frames[frameIndex + 1]!;
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);

      if (repeatedFrame) {
        nRepeats++;
      }

      const isUsedForGrouping = isFrameUsedForGrouping(frame);

      if (
        (frameIsVisible(frame, nextFrame) && !repeatedFrame) ||
        hiddenFrameIndices.includes(frameIndex)
      ) {
        const frameProps = {
          event,
          frame,
          prevFrame,
          nextFrame,
          isExpanded: expandFirstFrame && lastFrameIndex === frameIndex,
          emptySourceNotation: inlined
            ? false
            : lastFrameIndex === frameIndex && frameIndex === 0,
          platform,
          timesRepeated: nRepeats,
          showingAbsoluteAddress: showingAbsoluteAddresses,
          onAddressToggle: handleToggleAddresses,
          onShowFramesToggle: (e: React.MouseEvent<HTMLElement>) => {
            handleToggleFrames(e, frameIndex);
          },
          image: findImageForAddress({
            event,
            addrMode: frame.addrMode,
            address: frame.instructionAddr,
          }),
          maxLengthOfRelativeAddress: maxLengthOfAllRelativeAddresses,
          registers: {},
          includeSystemFrames,
          onFunctionNameToggle: handleToggleFunctionName,
          showCompleteFunctionName,
          hiddenFrameCount: frameCountMap[frameIndex],
          isHoverPreviewed,
          isShowFramesToggleExpanded: toggleFrameMap[frameIndex],
          isSubFrame: hiddenFrameIndices.includes(frameIndex),
          isUsedForGrouping,
          frameMeta: meta?.frames?.[frameIndex],
          registersMeta: meta?.registers,
        };

        nRepeats = 0;

        if (frameIndex === firstFrameOmitted) {
          return (
            <Fragment key={frameIndex}>
              <NativeFrame {...frameProps} />
              {renderOmittedFrames(firstFrameOmitted, lastFrameOmitted)}
            </Fragment>
          );
        }

        return <NativeFrame key={frameIndex} {...frameProps} />;
      }

      if (!repeatedFrame) {
        nRepeats = 0;
      }

      if (frameIndex !== firstFrameOmitted) {
        return null;
      }

      return renderOmittedFrames(firstFrameOmitted, lastFrameOmitted);
    })
    .filter(frame => !!frame) as React.ReactElement[];

  const wrapperClassName = `traceback ${
    includeSystemFrames ? 'full-traceback' : 'in-app-traceback'
  } ${className}`;

  if (convertedFrames.length > 0 && registers) {
    const lastFrame = convertedFrames.length - 1;
    convertedFrames[lastFrame] = cloneElement(convertedFrames[lastFrame]!, {
      registers,
    });
  }

  if (defined(maxDepth)) {
    convertedFrames = convertedFrames.slice(-maxDepth);
  }

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
        <Frames data-test-id="stack-trace">
          {!newestFirst ? convertedFrames : [...convertedFrames].reverse()}
        </Frames>
      </ContentPanel>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: relative;
`;

const ContentPanel = styled(Panel)<{hideIcon?: boolean}>`
  position: relative;
  border-top-left-radius: ${p => (p.hideIcon ? p.theme.borderRadius : 0)};
  overflow: hidden;
`;

export const Frames = styled('ul')`
  list-style: none;
`;
