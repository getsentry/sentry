import {cloneElement, Fragment, MouseEvent, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Client} from 'app/api';
import Line from 'app/components/events/interfaces/frame/line';
import {isExpandable} from 'app/components/events/interfaces/frame/utils';
import {
  getImageRange,
  parseAddress,
  stackTracePlatformIcon,
} from 'app/components/events/interfaces/utils';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import Placeholder from 'app/components/placeholder';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Frame, Group, PlatformType} from 'app/types';
import {Event} from 'app/types/event';
import {StacktraceType} from 'app/types/stacktrace';
import withApi from 'app/utils/withApi';

type Props = {
  data: StacktraceType;
  platform: PlatformType;
  event: Event;
  api: Client;
  hasGroupingTreeUI?: boolean;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  newestFirst?: boolean;
  className?: string;
  isHoverPreviewed?: boolean;
  includeSystemFrames?: boolean;
  expandFirstFrame?: boolean;
};

type GroupingLevel = {
  id: number;
  isCurrent: boolean;
};

function StackTraceContent({
  api,
  data,
  platform,
  event,
  newestFirst,
  className,
  isHoverPreviewed,
  hasGroupingTreeUI,
  groupingCurrentLevel,
  includeSystemFrames = true,
  expandFirstFrame = true,
}: Props) {
  const [showingAbsoluteAddresses, setShowingAbsoluteAddresses] = useState(false);
  const [showCompleteFunctionName, setShowCompleteFunctionName] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentGroupingLevel, setCurrentGroupingLevel] = useState<undefined | number>(
    groupingCurrentLevel
  );

  useEffect(() => {
    fetchGroupingLevel();
  }, []);

  async function fetchGroupingLevel() {
    const groupID = event.groupID;

    if (groupID === undefined || currentGroupingLevel !== undefined) {
      return;
    }

    setIsLoading(true);

    try {
      const response: {levels: GroupingLevel[]} = await api.requestPromise(
        `/issues/${event.groupID}/grouping/levels/`
      );

      const currentLevel = response.levels.find(level => level.isCurrent);
      if (!currentLevel) {
        return;
      }
      setCurrentGroupingLevel(currentLevel.id);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
    }
  }

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

    if (currentGroupingLevel === undefined || minGroupingLevel === undefined) {
      return false;
    }

    return minGroupingLevel <= currentGroupingLevel;
  }

  function hasExpandableFrame() {
    return frames.some((frame, frameIndex) =>
      isExpandable({
        frame,
        registers: registers ?? {},
        emptySourceNotation: frames.length - 1 === frameIndex && frameIndex === 0,
        platform,
      })
    );
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
    const hasAtLeastOneExpandableFrame = hasExpandableFrame();

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
            data: frame,
            isExpanded: expandFirstFrame && lastFrameIndex === frameIndex,
            emptySourceNotation: lastFrameIndex === frameIndex && frameIndex === 0,
            nextFrame,
            prevFrame,
            platform,
            timesRepeated: nRepeats,
            showingAbsoluteAddress: showingAbsoluteAddresses,
            onAddressToggle: handleToggleAddresses,
            image: findImageForAddress(frame.instructionAddr, frame.addrMode),
            maxLengthOfRelativeAddress: maxLengthOfAllRelativeAddresses,
            registers: {}, // TODO: Fix registers
            includeSystemFrames,
            onFunctionNameToggle: handleToggleFunctionName,
            showCompleteFunctionName,
            isHoverPreviewed,
            isFirst: newestFirst ? frameIndex === lastFrameIndex : frameIndex === 0,
            isPrefix: !!frame.isPrefix,
            isSentinel: !!frame.isSentinel,
            isUsedForGrouping: isFrameUsedForGrouping(frame),
            hasGroupingTreeUI,
            hasAtLeastOneExpandableFrame,
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
    <Wrapper className={getClassName()} isLoading={isLoading}>
      {isLoading ? (
        <Placeholder height="24px" />
      ) : (
        <Fragment>
          <StyledPlatformIcon
            platform={stackTracePlatformIcon(platform, frames)}
            size="20px"
            style={{borderRadius: '3px 0 0 3px'}}
          />
          <StyledList>{renderConvertedFrames()}</StyledList>
        </Fragment>
      )}
    </Wrapper>
  );
}

export default withApi(StackTraceContent);

const Wrapper = styled('div')<{isLoading: boolean}>`
  position: relative;
  ${p =>
    p.isLoading &&
    `
      border: none;
      border-radius: 0;
    `}
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  position: absolute;
  margin-top: -1px;
  left: -${space(3)};
`;

const StyledList = styled(List)`
  grid-gap: 0;
`;
