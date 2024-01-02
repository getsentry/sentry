import {cloneElement, Fragment, useState} from 'react';
import styled from '@emotion/styled';

import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {Frame, Group, PlatformKey} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';

import Line from '../../frame/line';
import {getImageRange, parseAddress, stackTracePlatformIcon} from '../../utils';

import StacktracePlatformIcon from './platformIcon';

type Props = {
  data: StacktraceType;
  event: Event;
  platform: PlatformKey;
  className?: string;
  expandFirstFrame?: boolean;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hideIcon?: boolean;
  includeSystemFrames?: boolean;
  isHoverPreviewed?: boolean;
  maxDepth?: number;
  meta?: Record<any, any>;
  newestFirst?: boolean;
};

export function HierarchicalGroupingContent({
  data,
  platform,
  event,
  newestFirst,
  className,
  isHoverPreviewed,
  groupingCurrentLevel,
  maxDepth,
  meta,
  hideIcon,
  includeSystemFrames = true,
  expandFirstFrame = true,
}: Props) {
  const [showingAbsoluteAddresses, setShowingAbsoluteAddresses] = useState(false);
  const [showCompleteFunctionName, setShowCompleteFunctionName] = useState(false);

  const {frames = [], framesOmitted, registers} = data;

  function findImageForAddress(
    address: Frame['instructionAddr'],
    addrMode: Frame['addrMode']
  ) {
    const images = event.entries.find(entry => entry.type === 'debugmeta')?.data?.images;

    return images && address
      ? images.find((img, idx) => {
          if (!addrMode || addrMode === 'abs') {
            const [startAddress, endAddress] = getImageRange(img);
            return address >= (startAddress as any) && address < (endAddress as any);
          }

          return addrMode === `rel:${idx}`;
        })
      : null;
  }

  function getClassName() {
    if (includeSystemFrames) {
      return `${className} traceback full-traceback`;
    }

    return `${className} traceback in-app-traceback`;
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
    return (
      <ListItem className="frame frames-omitted">
        {t(
          'Frames %d until %d were omitted and not available.',
          firstFrameOmitted,
          lastFrameOmitted
        )}
      </ListItem>
    );
  }

  function renderConvertedFrames() {
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

    let convertedFrames = frames
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
          const lineProps = {
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
                <Line {...lineProps} />
                {renderOmittedFrames(firstFrameOmitted, lastFrameOmitted)}
              </Fragment>
            );
          }

          return <Line key={frameIndex} {...lineProps} />;
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

    if (!newestFirst) {
      return convertedFrames;
    }

    return [...convertedFrames].reverse();
  }

  const platformIcon = stackTracePlatformIcon(platform, frames);

  return (
    <Wrapper className={getClassName()} data-test-id="stack-trace-content-v2">
      {!hideIcon && <StacktracePlatformIcon platform={platformIcon} />}
      <StyledList>{renderConvertedFrames()}</StyledList>
    </Wrapper>
  );
}

const Wrapper = styled(Panel)`
  position: relative;
  border-top-left-radius: 0;
`;

const StyledList = styled(List)`
  gap: 0;
`;
