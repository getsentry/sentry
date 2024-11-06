import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import type {Event} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {StackView} from 'sentry/types/stacktrace';
import {isNativePlatform} from 'sentry/utils/platform';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import Content from './content';
import {NativeContent} from './nativeContent';
import rawStacktraceContent from './rawContent';

type Props = {
  event: Event;
  newestFirst: boolean;
  platform: PlatformKey;
  stacktrace: StacktraceType;
  groupingCurrentLevel?: number;
  inlined?: boolean;
  lockAddress?: string;
  maxDepth?: number;
  meta?: Record<any, any>;
  stackView?: StackView;
  threadId?: number;
};

export function StackTraceContent({
  stackView,
  stacktrace,
  event,
  newestFirst,
  platform,
  groupingCurrentLevel,
  maxDepth,
  meta,
  inlined,
  threadId,
  lockAddress,
}: Props) {
  const hasStreamlinedUI = useHasStreamlinedUI();
  if (stackView === StackView.RAW) {
    return (
      <ErrorBoundary mini>
        <pre className="traceback plain">
          {rawStacktraceContent(stacktrace, event.platform)}
        </pre>
      </ErrorBoundary>
    );
  }

  if (isNativePlatform(platform)) {
    return (
      <ErrorBoundary mini>
        <StyledNativeContent
          data={stacktrace}
          includeSystemFrames={stackView === StackView.FULL}
          platform={platform}
          event={event}
          newestFirst={newestFirst}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta}
          inlined={inlined}
          hideIcon={inlined || hasStreamlinedUI}
          maxDepth={maxDepth}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary mini>
      <StyledContent
        data={stacktrace}
        className="no-exception"
        includeSystemFrames={stackView === StackView.FULL}
        platform={platform}
        event={event}
        newestFirst={newestFirst}
        meta={meta}
        hideIcon={inlined || hasStreamlinedUI}
        inlined={inlined}
        maxDepth={maxDepth}
        threadId={threadId}
        lockAddress={lockAddress}
      />
    </ErrorBoundary>
  );
}

const inlinedStyles = `
  border-radius: 0;
  border-left: 0;
  border-right: 0;
`;

const StyledNativeContent = styled(NativeContent)<{inlined?: boolean}>`
  ${p => p.inlined && inlinedStyles}
`;

const StyledContent = styled(Content)<{inlined?: boolean}>`
  ${p => p.inlined && inlinedStyles}
`;
