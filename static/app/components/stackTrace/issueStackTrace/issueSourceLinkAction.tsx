import {useMemo} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {OpenInContextLine} from 'sentry/components/events/interfaces/frame/openInContextLine';
import {StacktraceLink} from 'sentry/components/events/interfaces/frame/stacktraceLink';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import {useSentryAppComponentsStore} from 'sentry/utils/useSentryAppComponentsStore';

const HOVER_ACTIONS_SLOT_HEIGHT = 28;

interface IssueSourceLinkActionProps {
  isHovering?: boolean;
}

export function IssueSourceLinkAction({isHovering = false}: IssueSourceLinkActionProps) {
  const {frame, event, isExpanded} = useStackTraceFrameContext();
  const {project} = useStackTraceContext();

  const storeComponents = useSentryAppComponentsStore({
    componentType: 'stacktrace-link',
  });
  const components = useMemo(
    () =>
      storeComponents.filter(
        (
          component: SentryAppComponent
        ): component is SentryAppComponent<SentryAppSchemaStacktraceLink> =>
          component.type === 'stacktrace-link' &&
          component.schema.type === 'stacktrace-link'
      ),
    [storeComponents]
  );

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
    <Flex
      align="center"
      gap="xs"
      justify="end"
      width={{zero: 'auto', xl: hasContent ? 'max-content' : '0'}}
      flex={{zero: '0 1 auto', xl: hasContent ? '0 0 max-content' : '0 0 0'}}
      height={{
        zero: 'auto',
        xl: hasContent ? `${HOVER_ACTIONS_SLOT_HEIGHT}px` : '0',
      }}
      minHeight={{
        zero: '0',
        xl: hasContent ? `${HOVER_ACTIONS_SLOT_HEIGHT}px` : '0',
      }}
      overflow={{zero: 'visible', xl: 'hidden'}}
      whiteSpace="nowrap"
      pointerEvents="none"
      data-test-id="core-stacktrace-frame-actions-slot"
    >
      {showCodeMappingLink ? (
        <Flex
          as="span"
          align="center"
          pointerEvents="auto"
          onClick={e => e.stopPropagation()}
        >
          <StacktraceLink
            frame={frame}
            line={contextLine?.[1] ?? ''}
            event={event}
            disableSetup={false}
          />
        </Flex>
      ) : null}

      {showSentryAppStacktraceLink ? (
        <Flex
          as="span"
          align="center"
          pointerEvents="auto"
          onClick={e => e.stopPropagation()}
        >
          <OpenInContextLine
            lineNo={frame.lineNo ?? null}
            filename={frame.filename!}
            components={components}
          />
        </Flex>
      ) : null}
    </Flex>
  );
}
