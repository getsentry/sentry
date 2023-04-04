import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {PlatformType} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_VIEW, StacktraceType} from 'sentry/types/stacktrace';
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
  platform: PlatformType;
  stacktrace: StacktraceType;
  inlined?: boolean;
  maxDepth?: number;
  meta?: Record<any, any>;
  stackView?: STACK_VIEW;
};

export const StackTraceContent = ({
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
}: Props) => {
  if (stackView === STACK_VIEW.RAW) {
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
          includeSystemFrames={stackView === STACK_VIEW.FULL}
          platform={platform}
          event={event}
          newestFirst={newestFirst}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta}
          inlined={inlined}
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
          includeSystemFrames={stackView === STACK_VIEW.FULL}
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
        includeSystemFrames={stackView === STACK_VIEW.FULL}
        platform={platform}
        event={event}
        newestFirst={newestFirst}
        meta={meta}
        hideIcon={inlined}
        inlined={inlined}
        maxDepth={maxDepth}
      />
    </ErrorBoundary>
  );
};

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
