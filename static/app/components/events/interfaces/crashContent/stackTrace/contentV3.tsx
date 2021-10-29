import {cloneElement, Fragment, MouseEvent, useState} from 'react';
import styled from '@emotion/styled';

import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Frame, Group, PlatformType} from 'app/types';
import {Event} from 'app/types/event';
import {StacktraceType} from 'app/types/stacktrace';

import Line from '../../frame/lineV2';
import {getImageRange, parseAddress} from '../../utils';

type Props = {
  data: StacktraceType;
  platform: PlatformType;
  event: Event;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  newestFirst?: boolean;
  className?: string;
  isHoverPreviewed?: boolean;
  includeSystemFrames?: boolean;
  expandFirstFrame?: boolean;
};

function StackTraceContent({
  data,
  platform,
  event,
  newestFirst,
  className,
  isHoverPreviewed,
  groupingCurrentLevel,
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
    const classes = ['traceback'];

    if (className) {
      classes.push(className);
    }

    if (includeSystemFrames) {
      return [...classes, 'full-traceback'].join(' ');
    }

    return [...classes, 'in-app-traceback'].join(' ');
  }

  function isFrameUsedForGrouping(frame: Frame) {
    const {minGroupingLevel} = frame;

    if (groupingCurrentLevel === undefined || minGroupingLevel === undefined) {
      return false;
    }

    return minGroupingLevel <= groupingCurrentLevel;
  }

  function handleToggleAddresses(mouseEvent: MouseEvent<SVGElement>) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible
    setShowingAbsoluteAddresses(!showingAbsoluteAddresses);
  }

  function handleToggleFunctionName(mouseEvent: MouseEvent<SVGElement>) {
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
          };

          nRepeats = 0;

          if (frameIndex === firstFrameOmitted) {
            return (
              <Fragment key={frameIndex}>
                <Line {...lineProps} nativeV2 />
                {renderOmittedFrames(firstFrameOmitted, lastFrameOmitted)}
              </Fragment>
            );
          }

          return <Line key={frameIndex} nativeV2 {...lineProps} />;
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

      if (!newestFirst) {
        return convertedFrames;
      }

      return [...convertedFrames].reverse();
    }

    if (!newestFirst) {
      return convertedFrames;
    }

    return [...convertedFrames].reverse();
  }

  return <StyledList className={getClassName()}>{renderConvertedFrames()}</StyledList>;
}

export default StackTraceContent;

const StyledList = styled(List)`
  grid-gap: 0;
  position: relative;
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowLight};

  && {
    border-radius: ${p => p.theme.borderRadius};
    border: 1px solid ${p => p.theme.gray200};
    margin-bottom: ${space(3)};
  }
`;
