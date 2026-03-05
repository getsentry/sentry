import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {OpenInContextLine} from 'sentry/components/events/interfaces/frame/openInContextLine';
import {StacktraceLink} from 'sentry/components/events/interfaces/frame/stacktraceLink';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import useProjects from 'sentry/utils/useProjects';

import {VALID_SOURCE_MAP_DEBUGGER_FILE_ENDINGS} from './utils';

const HOVER_ACTIONS_SLOT_WIDTH = 'clamp(160px, 18vw, 220px)';
const HOVER_ACTIONS_SLOT_HEIGHT = 24;

interface SourceLinkActionProps {
  isHovering?: boolean;
}

export function SourceLinkAction({isHovering = false}: SourceLinkActionProps) {
  const {frame, event, isExpanded, frameIndex} = useStackTraceFrameContext();
  const {components, frameSourceMapDebuggerData, hideSourceMapDebugger} =
    useStackTraceContext();
  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(candidate => candidate.id === event.projectID),
    [event.projectID, projects]
  );

  const contextLine = frame.context?.find(([lineNumber]) => lineNumber === frame.lineNo);
  const frameCanShowActions =
    !!frame.filename && (frame.inApp || event.platform === 'csharp');
  const canShowFrameActions = frameCanShowActions && (isExpanded || isHovering);

  const frameSourceResolutionResults = frameSourceMapDebuggerData?.[frameIndex];
  const frameHasValidFileEndingForSourceMapDebugger =
    VALID_SOURCE_MAP_DEBUGGER_FILE_ENDINGS.some(
      ending =>
        (frame.absPath ?? '').endsWith(ending) || (frame.filename ?? '').endsWith(ending)
    );
  const shouldShowSourceMapDebuggerButton =
    !frame.context?.length &&
    !hideSourceMapDebugger &&
    frame.inApp &&
    frameHasValidFileEndingForSourceMapDebugger &&
    !!frameSourceResolutionResults &&
    !frameSourceResolutionResults.frameIsResolved;

  const showCodeMappingLink =
    canShowFrameActions && !!project && !shouldShowSourceMapDebuggerButton;
  const showSentryAppStacktraceLink = canShowFrameActions && components.length > 0;

  return (
    <FrameActionsSlot
      reserveSpace={frameCanShowActions}
      data-test-id="core-stacktrace-frame-actions-slot"
    >
      {showCodeMappingLink ? (
        <span onClick={e => e.stopPropagation()}>
          <StacktraceLink
            frame={frame}
            line={contextLine?.[1] ?? ''}
            event={event}
            disableSetup={false}
          />
        </span>
      ) : null}

      {showSentryAppStacktraceLink ? (
        <span onClick={e => e.stopPropagation()}>
          <OpenInContextLine
            lineNo={frame.lineNo ?? null}
            filename={frame.filename!}
            components={components}
          />
        </span>
      ) : null}
    </FrameActionsSlot>
  );
}

const FrameActionsSlot = styled(Flex)<{reserveSpace: boolean}>`
  align-items: center;
  gap: ${p => p.theme.space.sm};
  justify-content: flex-end;
  width: ${p => (p.reserveSpace ? HOVER_ACTIONS_SLOT_WIDTH : '0')};
  flex: ${p => (p.reserveSpace ? `0 0 ${HOVER_ACTIONS_SLOT_WIDTH}` : '0 0 0')};
  height: ${p => (p.reserveSpace ? `${HOVER_ACTIONS_SLOT_HEIGHT}px` : '0')};
  min-height: ${p => (p.reserveSpace ? `${HOVER_ACTIONS_SLOT_HEIGHT}px` : '0')};
  overflow: hidden;
  white-space: nowrap;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    width: auto;
    flex: 0 1 auto;
    height: auto;
    min-height: 0;
    overflow: visible;
  }
`;
