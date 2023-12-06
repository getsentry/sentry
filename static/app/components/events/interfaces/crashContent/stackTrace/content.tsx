import {cloneElement, Fragment, useState} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {Frame, Organization, PlatformKey} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {StackTraceMechanism, StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import withOrganization from 'sentry/utils/withOrganization';

import DeprecatedLine, {DeprecatedLineProps} from '../../frame/deprecatedLine';
import {
  findImageForAddress,
  getHiddenFrameIndices,
  getLastFrameIndex,
  isRepeatedFrame,
  parseAddress,
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
  platform: PlatformKey;
  className?: string;
  frameSourceMapDebuggerData?: FrameSourceMapDebuggerData[];
  hideIcon?: boolean;
  hideSourceMapDebugger?: boolean;
  isHoverPreviewed?: boolean;
  lockAddress?: string;
  maxDepth?: number;
  mechanism?: StackTraceMechanism | null;
  meta?: Record<any, any>;
  newestFirst?: boolean;
  organization?: Organization;
  threadId?: number;
} & Partial<DefaultProps>;

function Content({
  data,
  event,
  className,
  newestFirst,
  expandFirstFrame = true,
  platform,
  includeSystemFrames = true,
  isHoverPreviewed,
  maxDepth,
  meta,
  hideIcon,
  threadId,
  lockAddress,
  organization,
  frameSourceMapDebuggerData,
  hideSourceMapDebugger,
}: Props) {
  const [showingAbsoluteAddresses, setShowingAbsoluteAddresses] = useState(false);
  const [showCompleteFunctionName, setShowCompleteFunctionName] = useState(false);
  const [toggleFrameMap, setToggleFrameMap] = useState(setInitialFrameMap());

  const {frames = [], framesOmitted, registers} = data;

  function frameIsVisible(frame: Frame, nextFrame: Frame) {
    return (
      includeSystemFrames ||
      frame.inApp ||
      (nextFrame && nextFrame.inApp) ||
      // the last non-app frame
      (!frame.inApp && !nextFrame)
    );
  }

  function setInitialFrameMap(): {[frameIndex: number]: boolean} {
    const indexMap = {};
    (data.frames ?? []).forEach((frame, frameIdx) => {
      const nextFrame = (data.frames ?? [])[frameIdx + 1];
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
      const nextFrame = (data.frames ?? [])[frameIdx + 1];
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

  function isFrameAfterLastNonApp(): boolean {
    if (!frames.length || frames.length < 2) {
      return false;
    }

    const lastFrame = frames[frames.length - 1];
    const penultimateFrame = frames[frames.length - 2];

    return penultimateFrame.inApp && !lastFrame.inApp;
  }

  function handleToggleAddresses(mouseEvent: React.MouseEvent<SVGElement>) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible
    setShowingAbsoluteAddresses(oldShowAbsAddresses => !oldShowAbsAddresses);
  }

  function handleToggleFunctionName(mouseEvent: React.MouseEvent<SVGElement>) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible
    setShowCompleteFunctionName(oldShowCompleteName => !oldShowCompleteName);
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
    const props = {
      className: 'frame frames-omitted',
      key: 'omitted',
    };
    return (
      <li {...props}>
        {t(
          'Frames %d until %d were omitted and not available.',
          firstFrameOmitted,
          lastFrameOmitted
        )}
      </li>
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

  const mechanism =
    platform === 'java' && event.tags?.find(({key}) => key === 'mechanism')?.value;
  const isANR = mechanism === 'ANR' || mechanism === 'AppExitInfo';

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
      const nextFrame = frames[frameIndex + 1];
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);

      if (repeatedFrame) {
        nRepeats++;
      }

      if (
        (frameIsVisible(frame, nextFrame) && !repeatedFrame) ||
        hiddenFrameIndices.includes(frameIndex)
      ) {
        const frameProps: DeprecatedLineProps = {
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
          image: findImageForAddress({
            event,
            addrMode: frame.addrMode,
            address: frame.instructionAddr,
          }),
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
          isANR,
          threadId,
          lockAddress,
          hiddenFrameCount: frameCountMap[frameIndex],
          organization,
          frameSourceResolutionResults: frameSourceMapDebuggerData?.[frameIndex],
          hideSourceMapDebugger,
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

  const wrapperClassName = `${!!className && className} traceback ${
    includeSystemFrames ? 'full-traceback' : 'in-app-traceback'
  }`;

  const platformIcon = stackTracePlatformIcon(platform, data.frames ?? []);

  return (
    <Wrapper className={wrapperClassName} data-test-id="stack-trace-content">
      {!hideIcon && <StacktracePlatformIcon platform={platformIcon} />}
      <GuideAnchor target="stack_trace">
        <StyledList data-test-id="frames">
          {!newestFirst ? convertedFrames : [...convertedFrames].reverse()}
        </StyledList>
      </GuideAnchor>
    </Wrapper>
  );
}

const Wrapper = styled(Panel)`
  position: relative;
  border-top-left-radius: 0;
`;

const StyledList = styled('ul')`
  list-style: none;
`;

export default withOrganization(Content);
