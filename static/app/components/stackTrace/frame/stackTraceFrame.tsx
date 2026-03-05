import {Fragment, memo, useId, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {isExpandable as frameHasExpandableDetails} from 'sentry/components/events/interfaces/frame/utils';
import {
  StackTraceFrameContext,
  useStackTraceContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import type {StackTraceFrameContextValue} from 'sentry/components/stackTrace/stackTraceContext';
import type {FrameRow} from 'sentry/components/stackTrace/types';

import {
  ChevronAction,
  DefaultFrameActions,
  HiddenFramesToggleAction,
  SourceLinkAction,
  SourceMapsDebuggerAction,
} from './actions';
import {FrameContext} from './frameContext';
import {FrameHeader} from './frameHeader';

interface StackTraceFrameProps {
  row: FrameRow;
  children?: React.ReactNode;
}

const StackTraceFrameRoot = memo(function StackTraceFrameRoot({
  row,
  children,
}: StackTraceFrameProps) {
  const {
    event,
    frames,
    lastFrameIndex,
    platform,
    stacktrace,
    hiddenFrameToggleMap,
    toggleHiddenFrames,
  } = useStackTraceContext();

  const registers = row.frameIndex === frames.length - 1 ? stacktrace.registers : {};
  const [isExpanded, setIsExpanded] = useState(() => row.frameIndex === lastFrameIndex);

  const isFrameExpandable = frameHasExpandableDetails({
    frame: row.frame,
    registers,
    platform,
  });

  const frameContextId = useId();

  const value = useMemo<StackTraceFrameContextValue>(
    () => ({
      event,
      frame: row.frame,
      frameContextId,
      frameIndex: row.frameIndex,
      hiddenFrameCount: row.hiddenFrameCount,
      hiddenFramesExpanded: !!hiddenFrameToggleMap[row.frameIndex],
      isExpandable: isFrameExpandable,
      isExpanded,
      nextFrame: row.nextFrame,
      platform,
      timesRepeated: row.timesRepeated,
      toggleExpansion: () => {
        setIsExpanded(prevState => !prevState);
      },
      toggleHiddenFrames: () => {
        toggleHiddenFrames(row.frameIndex);
      },
    }),
    [
      event,
      frameContextId,
      hiddenFrameToggleMap,
      isExpanded,
      isFrameExpandable,
      platform,
      row.frame,
      row.frameIndex,
      row.hiddenFrameCount,
      row.nextFrame,
      row.timesRepeated,
      toggleHiddenFrames,
    ]
  );

  return (
    <StackTraceFrameContext.Provider value={value}>
      <FrameRowContainer data-test-id="core-stacktrace-frame-row">
        {children ?? (
          <Fragment>
            <FrameHeader
              actions={({isHovering}) => <DefaultFrameActions isHovering={isHovering} />}
            />
            <FrameContext />
          </Fragment>
        )}
      </FrameRowContainer>
    </StackTraceFrameContext.Provider>
  );
});

function StackTraceFrameActionsContainer({children}: {children: React.ReactNode}) {
  return (
    <Flex gap="xs" align="center">
      {children}
    </Flex>
  );
}

const StackTraceFrameActions = Object.assign(StackTraceFrameActionsContainer, {
  Chevron: ChevronAction,
  Default: DefaultFrameActions,
  HiddenFramesToggle: HiddenFramesToggleAction,
  SourceLink: SourceLinkAction,
  SourceMapsDebugger: SourceMapsDebuggerAction,
});

export const StackTraceFrame = Object.assign(StackTraceFrameRoot, {
  Context: FrameContext,
  Header: FrameHeader,
  Actions: StackTraceFrameActions,
});

const FrameRowContainer = styled('div')`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding-left: 0;

  &:first-of-type {
    border-top: 0;
  }
`;
