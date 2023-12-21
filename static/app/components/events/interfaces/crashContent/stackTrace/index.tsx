import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {PlatformKey} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {StacktraceType, StackView} from 'sentry/types/stacktrace';
import {isNativePlatform} from 'sentry/utils/platform';

import Content from './content';
import {HierarchicalGroupingContent} from './hierarchicalGroupingContent';
import {NativeContent} from './nativeContent';
import rawStacktraceContent from './rawContent';

type Props = Pick<
  React.ComponentProps<typeof HierarchicalGroupingContent>,
  'groupingCurrentLevel'
> & {
  event: Event;
  hasHierarchicalGrouping: boolean;
  newestFirst: boolean;
  platform: PlatformKey;
  stacktrace: StacktraceType;
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
  hasHierarchicalGrouping,
  groupingCurrentLevel,
  maxDepth,
  meta,
  inlined,
  threadId,
  lockAddress,
}: Props) {
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
          hideIcon={inlined}
          maxDepth={maxDepth}
        />
      </ErrorBoundary>
    );
  }

  if (hasHierarchicalGrouping) {
    return (
      <ErrorBoundary mini>
        <StyledHierarchicalGroupingContent
          data={stacktrace}
          className="no-exception"
          includeSystemFrames={stackView === StackView.FULL}
          platform={platform}
          event={event}
          newestFirst={newestFirst}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta}
          hideIcon={inlined}
          inlined={inlined}
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
        hideIcon={inlined}
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

const StyledHierarchicalGroupingContent = styled(HierarchicalGroupingContent)<{
  inlined?: boolean;
}>`
  ${p => p.inlined && inlinedStyles}
`;

const StyledContent = styled(Content)<{inlined?: boolean}>`
  ${p => p.inlined && inlinedStyles}
`;
