import {memo, useId, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {isExpandable as frameHasExpandableDetails} from 'sentry/components/events/interfaces/frame/utils';
import {
  StackTraceFrameContext,
  useStackTraceContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import type {StackTraceFrameContextValue} from 'sentry/components/stackTrace/stackTraceContext';
import type {FrameRow} from 'sentry/components/stackTrace/types';

import {ChevronAction} from './actions/chevron';
import {DefaultFrameActions} from './actions/default';
import {HiddenFramesToggleAction} from './actions/hiddenFramesToggle';
import {FrameContent} from './frameContent';
import {FrameHeader} from './frameHeader';

interface StackTraceFrameRowProps {
  children: React.ReactNode;
  row: FrameRow;
}

const StackTraceFrameRowRoot = memo(function StackTraceFrameRowRoot({
  row,
  children,
}: StackTraceFrameRowProps) {
  const {
    event,
    frames,
    hasScmSourceContext,
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
    hasScmSourceContext,
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
      isExpandable: !!isFrameExpandable,
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
        {children}
      </FrameRowContainer>
    </StackTraceFrameContext.Provider>
  );
});

function FrameRowActionsContainer({children}: {children: React.ReactNode}) {
  return (
    <Flex gap="xs" align="center">
      {children}
    </Flex>
  );
}

const FrameRowActions = Object.assign(FrameRowActionsContainer, {
  Chevron: ChevronAction,
  Default: DefaultFrameActions,
  HiddenFramesToggle: HiddenFramesToggleAction,
});

export const StackTraceFrameRow = Object.assign(StackTraceFrameRowRoot, {
  Context: FrameContent,
  Header: FrameHeader,
  Actions: FrameRowActions,
});

const FrameRowContainer = styled('div')``;
