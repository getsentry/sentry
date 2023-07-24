import {cloneElement, Fragment, useState} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {StacktraceFilenameQuery} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebug';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {Frame, Organization, PlatformType} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {StackTraceMechanism, StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import withOrganization from 'sentry/utils/withOrganization';

import DeprecatedLine from '../../frame/deprecatedLine';
import {getImageRange, parseAddress, stackTracePlatformIcon} from '../../utils';

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

function Content({
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

  function getRepeatedFrameIndices() {
    const repeats: number[] = [];
    (data.frames ?? []).forEach((frame, frameIdx) => {
      const nextFrame = (data.frames ?? [])[frameIdx + 1];
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);

      if (repeatedFrame) {
        repeats.push(frameIdx);
      }
    });
    return repeats;
  }

  function getHiddenFrameIndices(frameCountMap: {[frameIndex: number]: number}) {
    const repeatedIndeces = getRepeatedFrameIndices();
    let hiddenFrameIndices: number[] = [];
    Object.keys(toggleFrameMap)
      .filter(frameIndex => toggleFrameMap[frameIndex] === true)
      .forEach(indexString => {
        const index = parseInt(indexString, 10);
        const indicesToBeAdded: number[] = [];
        let i = 1;
        let numHidden = frameCountMap[index];
        while (numHidden > 0) {
          if (!repeatedIndeces.includes(index - i)) {
            indicesToBeAdded.push(index - i);
            numHidden -= 1;
          }
          i += 1;
        }
        hiddenFrameIndices = [...hiddenFrameIndices, ...indicesToBeAdded];
      });
    return hiddenFrameIndices;
  }

  function findImageForAddress(
    address: Frame['instructionAddr'],
    addrMode: Frame['addrMode']
  ) {
    const images = event.entries.find(entry => entry.type === 'debugmeta')?.data?.images;

    if (!images || !address) {
      return null;
    }

    const image = images.find((img, idx) => {
      if (!addrMode || addrMode === 'abs') {
        const [startAddress, endAddress] = getImageRange(img);
        return address >= (startAddress as any) && address < (endAddress as any);
      }

      return addrMode === `rel:${idx}`;
    });

    return image;
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

  function getLastFrameIndex() {
    const inAppFrameIndexes = frames
      .map((frame, frameIndex) => {
        if (frame.inApp) {
          return frameIndex;
        }
        return undefined;
      })
      .filter(frame => frame !== undefined);

    return !inAppFrameIndexes.length
      ? frames.length - 1
      : inAppFrameIndexes[inAppFrameIndexes.length - 1];
  }

  function renderOmittedFrames(firstFrameOmitted: any, lastFrameOmitted: any) {
    return t(
      'Frames %d until %d were omitted and not available.',
      firstFrameOmitted,
      lastFrameOmitted
    );
  }

  const firstFrameOmitted = framesOmitted?.[0] ?? null;
  const lastFrameOmitted = framesOmitted?.[1] ?? null;
  const lastFrameIndex = getLastFrameIndex();
  const frameCountMap = getInitialFrameCounts();
  const hiddenFrameIndices: number[] = getHiddenFrameIndices(frameCountMap);

  const mechanism =
    platform === 'java' && event.tags?.find(({key}) => key === 'mechanism')?.value;
  const isANR = mechanism === 'ANR' || mechanism === 'AppExitInfo';

  let nRepeats = 0;

  const maxLengthOfAllRelativeAddresses = frames.reduce(
    (maxLengthUntilThisPoint, frame) => {
      const correspondingImage = findImageForAddress(
        frame.instructionAddr,
        frame.addrMode
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
          image: findImageForAddress(frame.instructionAddr, frame.addrMode),
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
