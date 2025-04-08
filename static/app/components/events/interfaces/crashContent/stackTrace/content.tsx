import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import type {Event, Frame} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import type {StackTraceMechanism, StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';

import type {DeprecatedLineProps} from '../../frame/deprecatedLine';
import DeprecatedLine from '../../frame/deprecatedLine';
import {
  getHiddenFrameIndices,
  getLastFrameIndex,
  isRepeatedFrame,
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
  newestFirst: boolean;
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
  isHoverPreviewed = false,
  maxDepth,
  meta,
  hideIcon,
  threadId,
  lockAddress,
  frameSourceMapDebuggerData,
  hideSourceMapDebugger = false,
}: Props) {
  const [toggleFrameMap, setToggleFrameMap] = useState(setInitialFrameMap());

  const {frames = [], framesOmitted, registers} = data;

  function frameIsVisible(frame: Frame, nextFrame: Frame) {
    return (
      includeSystemFrames ||
      frame.inApp ||
      nextFrame?.inApp ||
      // the last non-app frame
      (!frame.inApp && !nextFrame)
    );
  }

  function setInitialFrameMap(): Record<number, boolean> {
    const indexMap: Record<string, boolean> = {};
    (data.frames ?? []).forEach((frame, frameIdx) => {
      const nextFrame = (data.frames ?? [])[frameIdx + 1]!;
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);
      if (frameIsVisible(frame, nextFrame) && !repeatedFrame && !frame.inApp) {
        indexMap[frameIdx] = false;
      }
    });
    return indexMap;
  }

  function getInitialFrameCounts(): Record<number, number> {
    let count = 0;
    const countMap: Record<string, number> = {};
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
    return (
      <li key="omitted" className="frame frames-omitted">
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

  let convertedFrames = frames
    .map((frame, frameIndex) => {
      const nextFrame = frames[frameIndex + 1]!;
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);
      const isLastFrame = frameIndex === frames.length - 1;

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
          nextFrame,
          platform,
          timesRepeated: nRepeats,
          registers: isLastFrame ? registers : {},
          onShowFramesToggle: (e: React.MouseEvent<HTMLElement>) => {
            handleToggleFrames(e, frameIndex);
          },
          isSubFrame: hiddenFrameIndices.includes(frameIndex),
          isShowFramesToggleExpanded: toggleFrameMap[frameIndex],
          isHoverPreviewed,
          frameMeta: meta?.frames?.[frameIndex],
          registersMeta: meta?.registers,
          isANR,
          threadId,
          lockAddress,
          hiddenFrameCount: frameCountMap[frameIndex],
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
    .filter((frame): frame is React.ReactElement => !!frame);

  if (defined(maxDepth)) {
    convertedFrames = convertedFrames.slice(-maxDepth);
  }

  const wrapperClassName = `${!!className && className} traceback ${
    includeSystemFrames ? 'full-traceback' : 'in-app-traceback'
  }`;

  const platformIcon = stackTracePlatformIcon(platform, data.frames ?? []);

  return (
    <Wrapper>
      {hideIcon ? null : <StacktracePlatformIcon platform={platformIcon} />}
      <StackTraceContentPanel
        className={wrapperClassName}
        data-test-id="stack-trace-content"
        hideIcon={hideIcon}
      >
        <StyledList data-test-id="frames">
          {newestFirst ? [...convertedFrames].reverse() : convertedFrames}
        </StyledList>
      </StackTraceContentPanel>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: relative;
`;

export const StackTraceContentPanel = styled(Panel)<{hideIcon?: boolean}>`
  position: relative;
  overflow: hidden;

  ${p =>
    !p.hideIcon &&
    css`
      border-top-left-radius: 0;
      @media (max-width: ${p.theme.breakpoints.medium}) {
        border-top-left-radius: ${p.theme.borderRadius};
      }
    `}
`;

const StyledList = styled('ul')`
  list-style: none;
`;

export default Content;
