import {cloneElement, Fragment, MouseEvent, useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import Line from 'app/components/events/interfaces/frame/lineV2';
import {isExpandable} from 'app/components/events/interfaces/frame/utils';
import {
  getImageRange,
  parseAddress,
  stackTracePlatformIcon,
} from 'app/components/events/interfaces/utils';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Frame, Group, PlatformType} from 'app/types';
import {Event} from 'app/types/event';
import {StacktraceType} from 'app/types/stacktrace';

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
    if (includeSystemFrames) {
      return `${className} traceback full-traceback`;
    }

    return `${className} traceback in-app-traceback`;
  }

  function handleToggleAddresses(mouseEvent: MouseEvent<SVGElement>) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsable
    setShowingAbsoluteAddresses(!showingAbsoluteAddresses);
  }

  function handleToggleFunctionName(mouseEvent: MouseEvent<SVGElement>) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsable
    setShowCompleteFunctionName(!showCompleteFunctionName);
  }

  function isFrameUsedForGrouping(frame: Frame) {
    const {minGroupingLevel} = frame;

    if (groupingCurrentLevel === undefined || minGroupingLevel === undefined) {
      return false;
    }

    return minGroupingLevel <= groupingCurrentLevel;
  }

  function getFramesDetails() {
    let haveFramesAtLeastOneExpandedFrame = false;
    let haveFramesAtLeastOneGroupingBadge = false;

    for (const frameIndex in frames) {
      const frame = frames[Number(frameIndex)];
      if (!haveFramesAtLeastOneExpandedFrame) {
        haveFramesAtLeastOneExpandedFrame = isExpandable({
          frame,
          registers: registers ?? {},
          emptySourceNotation:
            frames.length - 1 === Number(frameIndex) && Number(frameIndex) === 0,
          platform,
        });
      }

      if (!haveFramesAtLeastOneGroupingBadge) {
        haveFramesAtLeastOneGroupingBadge =
          isFrameUsedForGrouping(frame) || !!frame.isPrefix || !!frame.isSentinel;
      }

      if (haveFramesAtLeastOneExpandedFrame && haveFramesAtLeastOneGroupingBadge) {
        break;
      }
    }

    return {
      haveFramesAtLeastOneExpandedFrame,
      haveFramesAtLeastOneGroupingBadge,
    };
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
    const lastFrameIndex = frames.length - 1;
    const {haveFramesAtLeastOneExpandedFrame, haveFramesAtLeastOneGroupingBadge} =
      getFramesDetails();

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

        const isVisible =
          includeSystemFrames || frame.inApp || frame.minGroupingLevel !== undefined;

        if (isVisible && !repeatedFrame) {
          const lineProps = {
            event,
            frame,
            isExpanded: expandFirstFrame && lastFrameIndex === frameIndex,
            emptySourceNotation: lastFrameIndex === frameIndex && frameIndex === 0,
            prevFrame,
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
            isPrefix: !!frame.isPrefix,
            isSentinel: !!frame.isSentinel,
            isUsedForGrouping: isFrameUsedForGrouping(frame),
            haveFramesAtLeastOneExpandedFrame,
            haveFramesAtLeastOneGroupingBadge,
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

  return (
    <Wrapper className={getClassName()}>
      <StyledPlatformIcon
        platform={stackTracePlatformIcon(platform, frames)}
        size="20px"
        style={{borderRadius: '3px 0 0 3px'}}
      />
      <StyledList>{renderConvertedFrames()}</StyledList>
    </Wrapper>
  );
}

export default StackTraceContent;

const Wrapper = styled('div')`
  position: relative;
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  position: absolute;
  margin-top: -1px;
  left: -${space(3)};
`;

const StyledList = styled(List)`
  grid-gap: 0;
`;
