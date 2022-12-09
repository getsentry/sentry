import {cloneElement, Fragment, useState} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Frame, Group, PlatformType} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {StacktraceType} from 'sentry/types/stacktrace';

import NativeFrame from '../../nativeFrame';
import {getImageRange, parseAddress} from '../../utils';

type Props = {
  data: StacktraceType;
  event: Event;
  platform: PlatformType;
  expandFirstFrame?: boolean;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  includeSystemFrames?: boolean;
  isHoverPreviewed?: boolean;
  meta?: Record<any, any>;
  newestFirst?: boolean;
};

function Content({
  data,
  platform,
  event,
  newestFirst,
  isHoverPreviewed,
  groupingCurrentLevel,
  includeSystemFrames = true,
  expandFirstFrame = true,
  meta,
}: Props) {
  const [showingAbsoluteAddresses, setShowingAbsoluteAddresses] = useState(false);
  const [showCompleteFunctionName, setShowCompleteFunctionName] = useState(false);

  const {frames = [], framesOmitted, registers} = data;

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

  const convertedFrames = frames
    .map((frame, frameIndex) => {
      const prevFrame = frames[frameIndex - 1];
      const nextFrame = frames[frameIndex + 1];

      const repeatedFrame =
        nextFrame &&
        frame.lineNo === nextFrame.lineNo &&
        frame.instructionAddr === nextFrame.instructionAddr &&
        frame.package === nextFrame.package &&
        frame.module === nextFrame.module &&
        frame.function === nextFrame.function;

      if (repeatedFrame) {
        nRepeats++;
      }

      const isUsedForGrouping = isFrameUsedForGrouping(frame);

      const isVisible =
        includeSystemFrames ||
        frame.inApp ||
        (nextFrame && nextFrame.inApp) ||
        // the last non-app frame
        (!frame.inApp && !nextFrame) ||
        isUsedForGrouping;

      if (isVisible && !repeatedFrame) {
        const frameProps = {
          event,
          frame,
          prevFrame,
          nextFrame,
          isExpanded: expandFirstFrame && lastFrameIndex === frameIndex,
          emptySourceNotation: lastFrameIndex === frameIndex && frameIndex === 0,
          platform,
          timesRepeated: nRepeats,
          showingAbsoluteAddress: showingAbsoluteAddresses,
          onAddressToggle: handleToggleAddresses,
          image: findImageForAddress(frame.instructionAddr, frame.addrMode),
          maxLengthOfRelativeAddress: maxLengthOfAllRelativeAddresses,
          registers: {},
          includeSystemFrames,
          onFunctionNameToggle: handleToggleFunctionName,
          showCompleteFunctionName,
          isHoverPreviewed,
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

  const className = `traceback ${
    includeSystemFrames ? 'full-traceback' : 'in-app-traceback'
  }`;

  if (convertedFrames.length > 0 && registers) {
    const lastFrame = convertedFrames.length - 1;
    convertedFrames[lastFrame] = cloneElement(convertedFrames[lastFrame], {
      registers,
    });

    return (
      <Wrapper className={className}>
        <Frames isHoverPreviewed={isHoverPreviewed} data-test-id="stack-trace">
          {!newestFirst ? convertedFrames : [...convertedFrames].reverse()}
        </Frames>
      </Wrapper>
    );
  }

  return (
    <Wrapper className={className}>
      <Frames isHoverPreviewed={isHoverPreviewed} data-test-id="stack-trace">
        {!newestFirst ? convertedFrames : [...convertedFrames].reverse()}
      </Frames>
    </Wrapper>
  );
}

export default Content;

const Wrapper = styled(Panel)`
  && {
    border-top-left-radius: 0;
    position: relative;
    border: 0;
  }
`;

const Frames = styled('ul')<{isHoverPreviewed?: boolean}>`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => 'solid ' + p.theme.border};
  box-shadow: ${p => p.theme.dropShadowLight};
  margin-bottom: ${space(2)};
  position: relative;
  display: grid;
  overflow: hidden;
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 16px;
  color: ${p => p.theme.gray500};
  ${p =>
    p.isHoverPreviewed &&
    `
      border: 0;
      border-radius: 0;
      box-shadow: none;
      margin-bottom: 0;
    `}
`;
