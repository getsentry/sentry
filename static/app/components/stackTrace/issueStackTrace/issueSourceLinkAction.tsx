import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {OpenInContextLine} from 'sentry/components/events/interfaces/frame/openInContextLine';
import {StacktraceLink} from 'sentry/components/events/interfaces/frame/stacktraceLink';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';

const HOVER_ACTIONS_SLOT_HEIGHT = 28;

interface IssueSourceLinkActionProps {
  isHovering?: boolean;
}

export function IssueSourceLinkAction({isHovering = false}: IssueSourceLinkActionProps) {
  const {frame, event, isExpanded} = useStackTraceFrameContext();
  const {components, project} = useStackTraceContext();

  const contextLine = frame.context?.find(([lineNumber]) => lineNumber === frame.lineNo);
  const frameCanShowActions =
    !!frame.filename && (frame.inApp || event.platform === 'csharp');
  const canShowFrameActions = frameCanShowActions && (isExpanded || isHovering);

  const showCodeMappingLink = canShowFrameActions && !!project;
  const showSentryAppStacktraceLink = canShowFrameActions && components.length > 0;

  const wouldShowCodeMappingLink = frameCanShowActions && !!project;
  const wouldShowSentryAppStacktraceLink = frameCanShowActions && components.length > 0;
  const hasContent = wouldShowCodeMappingLink || wouldShowSentryAppStacktraceLink;

  return (
    <FrameActionsSlot
      reserveSpace={hasContent}
      data-test-id="core-stacktrace-frame-actions-slot"
    >
      {showCodeMappingLink ? (
        <Flex as="span" align="center" onClick={e => e.stopPropagation()}>
          <StacktraceLink
            frame={frame}
            line={contextLine?.[1] ?? ''}
            event={event}
            disableSetup={false}
          />
        </Flex>
      ) : null}

      {showSentryAppStacktraceLink ? (
        <Flex as="span" align="center" onClick={e => e.stopPropagation()}>
          <OpenInContextLine
            lineNo={frame.lineNo ?? null}
            filename={frame.filename!}
            components={components}
          />
        </Flex>
      ) : null}
    </FrameActionsSlot>
  );
}

const FrameActionsSlot = styled(Flex)<{reserveSpace: boolean}>`
  align-items: center;
  gap: ${p => p.theme.space.sm};
  justify-content: flex-end;
  width: ${p => (p.reserveSpace ? 'max-content' : '0')};
  flex: ${p => (p.reserveSpace ? '0 0 max-content' : '0 0 0')};
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
