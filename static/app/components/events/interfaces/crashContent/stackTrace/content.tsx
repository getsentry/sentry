import {cloneElement, Fragment, useState} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {StacktraceFilenameQuery} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebug';
import Panel from 'sentry/components/panels/panel';
import {Frame, Organization, PlatformType} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {StackTraceMechanism, StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';

import DeprecatedLine from '../../frame/deprecatedLine';
import {
  findImageForAddress,
  getHiddenFrameIndices,
  getInitialFrameCounts,
  getLastFrameIndex,
  isRepeatedFrame,
  parseAddress,
  renderOmittedFrames,
  setInitialFrameMap,
  stackTracePlatformIcon,
} from '../../utils';

import StacktracePlatformIcon from './platformIcon';

type DefaultProps = {
  expandFirstFrame: boolean;
  includeSystemFrames: boolean;
};

type Props = {
  data: StacktraceType;
  event: Event;
  platform: PlatformType;
  className?: string;
  debugFrames?: StacktraceFilenameQuery[];
  hideIcon?: boolean;
  isHoverPreviewed?: boolean;
  lockAddress?: string;
  maxDepth?: number;
  mechanism?: StackTraceMechanism | null;
  meta?: Record<any, any>;
  newestFirst?: boolean;
  organization?: Organization;
  threadId?: number;
} & Partial<DefaultProps>;

export default function Content({
  data,
  event,
  newestFirst,
  expandFirstFrame,
  platform,
  includeSystemFrames,
  isHoverPreviewed,
  maxDepth,
  meta,
  debugFrames,
  hideIcon,
  threadId,
  lockAddress,
}: Props) {
  const [showingAbsoluteAddresses, setShowingAbsoluteAddresses] = useState(false);
  const [showCompleteFunctionName, setShowCompleteFunctionName] = useState(false);
  const [toggleFrameMap, setToggleFrameMap] = useState(
    setInitialFrameMap(data, frameIsVisible)
  );

  const {frames = [], framesOmitted, registers} = data;

  const firstFrameOmitted = framesOmitted?.[0] ?? null;
  const lastFrameOmitted = framesOmitted?.[1] ?? null;
  const lastFrameIndex = getLastFrameIndex(frames);
  const frameCountMap = getInitialFrameCounts(data, frameIsVisible);
  const hiddenFrameIndices: number[] = getHiddenFrameIndices(
    toggleFrameMap,
    frameCountMap,
    data
  );

  const mechanism =
    platform === 'java' && event.tags?.find(({key}) => key === 'mechanism')?.value;
  const isANR = mechanism === 'ANR' || mechanism === 'AppExitInfo';

  let nRepeats = 0;

  const maxLengthOfAllRelativeAddresses = frames.reduce(
    (maxLengthUntilThisPoint, frame) => {
      const correspondingImage = findImageForAddress(
        frame.instructionAddr,
        frame.addrMode,
        event
      );

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

  function frameIsVisible(frame: Frame, nextFrame: Frame) {
    return (
      includeSystemFrames ||
      frame.inApp ||
      (nextFrame && nextFrame.inApp) ||
      // the last non-app frame
      (!frame.inApp && !nextFrame)
    );
  }

  function handleToggleAddresses(mouseEvent: React.MouseEvent<SVGElement>) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible
    setShowingAbsoluteAddresses(!showingAbsoluteAddresses);
  }

  function handleToggleFunctionName(mouseEvent: React.MouseEvent<SVGElement>) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible
    setShowCompleteFunctionName(!showCompleteFunctionName);
  }

  function isFrameAfterLastNonApp(): boolean {
    if (!frames.length || frames.length < 2) {
      return false;
    }

    const lastFrame = frames[frames.length - 1];
    const penultimateFrame = frames[frames.length - 2];

    return penultimateFrame.inApp && !lastFrame.inApp;
  }

  let convertedFrames = frames
    .map((frame, frameIndex) => {
      const prevFrame = frames[frameIndex - 1];
      const nextFrame = frames[frameIndex + 1];
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);

      if (repeatedFrame) {
        nRepeats++;
      }

      if (
        (frameIsVisible(frame, nextFrame) && !repeatedFrame) ||
        hiddenFrameIndices.includes(frameIndex)
      ) {
        const frameProps = {
          event,
          data: frame,
          isExpanded: expandFirstFrame && lastFrameIndex === frameIndex,
          emptySourceNotation: lastFrameIndex === frameIndex && frameIndex === 0,
          isOnlyFrame: (data.frames ?? []).length === 1,
          nextFrame,
          prevFrame,
          platform,
          timesRepeated: nRepeats,
          showingAbsoluteAddress: showingAbsoluteAddresses,
          onAddressToggle: handleToggleAddresses,
          image: findImageForAddress(frame.instructionAddr, frame.addrMode, event),
          maxLengthOfRelativeAddress: maxLengthOfAllRelativeAddresses,
          registers: {}, // TODO: Fix registers
          isFrameAfterLastNonApp: isFrameAfterLastNonApp(),
          includeSystemFrames,
          onFunctionNameToggle: handleToggleFunctionName,
          onShowFramesToggle: (e: React.MouseEvent<HTMLElement>) => {
            handleToggleFrames(e, frameIndex);
          },
          isSubFrame: hiddenFrameIndices.includes(frameIndex),
          isShowFramesToggleExpanded: toggleFrameMap[frameIndex],
          showCompleteFunctionName,
          isHoverPreviewed,
          frameMeta: meta?.frames?.[frameIndex],
          registersMeta: meta?.registers,
          debugFrames,
          isANR,
          threadId,
          lockAddress,
          hiddenFrameCount: frameCountMap[frameIndex],
        };

        nRepeats = 0;

        if (frameIndex === firstFrameOmitted) {
          return (
            <Fragment key={frameIndex}>
              <DeprecatedLine {...frameProps} />
              {renderOmittedFrames(firstFrameOmitted, lastFrameOmitted)}
            </Fragment>
          );
        }

        return <DeprecatedLine key={frameIndex} {...frameProps} />;
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

  if (convertedFrames.length > 0 && registers) {
    const lastFrame = convertedFrames.length - 1;
    convertedFrames[lastFrame] = cloneElement(convertedFrames[lastFrame], {
      registers,
    });
  }

  if (defined(maxDepth)) {
    convertedFrames = convertedFrames.slice(-maxDepth);
  }

  const className = `traceback ${
    includeSystemFrames ? 'full-traceback' : 'in-app-traceback'
  }`;

  const platformIcon = stackTracePlatformIcon(platform, data.frames ?? []);

  return (
    <Wrapper className={className} data-test-id="stack-trace-content">
      {!hideIcon && <StacktracePlatformIcon platform={platformIcon} />}
      <GuideAnchor target="stack_trace">
        <Frames data-test-id="frames">
          {!newestFirst ? convertedFrames : [...convertedFrames].reverse()}
        </Frames>
      </GuideAnchor>
    </Wrapper>
  );
}

const Wrapper = styled(Panel)`
  position: relative;
  border-top-left-radius: 0;
`;

const Frames = styled('ul')`
  list-style: none;
`;
