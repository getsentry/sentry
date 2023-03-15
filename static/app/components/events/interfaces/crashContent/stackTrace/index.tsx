import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {PlatformType} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_VIEW, StacktraceType} from 'sentry/types/stacktrace';
import {isNativePlatform} from 'sentry/utils/platform';

import Content from './content';
import ContentV2 from './contentV2';
import ContentV3 from './contentV3';
import rawStacktraceContent from './rawContent';

type Props = Pick<React.ComponentProps<typeof ContentV2>, 'groupingCurrentLevel'> & {
  event: Event;
  hasHierarchicalGrouping: boolean;
  newestFirst: boolean;
  platform: PlatformType;
  stacktrace: StacktraceType;
  inlined?: boolean;
  meta?: Record<any, any>;
  nativeV2?: boolean;
  stackView?: STACK_VIEW;
};

function StackTrace({
  stackView,
  stacktrace,
  event,
  newestFirst,
  platform,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
  nativeV2,
  meta,
  inlined,
}: Props) {
  if (stackView === STACK_VIEW.RAW) {
    return (
      <ErrorBoundary mini>
        <pre className="traceback plain">
          {rawStacktraceContent(stacktrace, event.platform)}
        </pre>
      </ErrorBoundary>
    );
  }

  if (nativeV2 && isNativePlatform(platform)) {
    return (
      <ErrorBoundary mini>
        <StyledContentV3
          data={stacktrace}
          includeSystemFrames={stackView === STACK_VIEW.FULL}
          platform={platform}
          event={event}
          newestFirst={newestFirst}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta}
          hideIcon={inlined}
          inlined={inlined}
        />
      </ErrorBoundary>
    );
  }

  if (hasHierarchicalGrouping) {
    return (
      <ErrorBoundary mini>
        <StyledContentV2
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
      />
    </ErrorBoundary>
  );
}

const inlinedStyles = `
  border-radius: 0;
  border-left: 0;
  border-right: 0;
`;

const StyledContentV3 = styled(ContentV3)<{inlined?: boolean}>`
  ${p => p.inlined && inlinedStyles}
`;

const StyledContentV2 = styled(ContentV2)<{inlined?: boolean}>`
  ${p => p.inlined && inlinedStyles}
`;

const StyledContent = styled(Content)<{inlined?: boolean}>`
  ${p => p.inlined && inlinedStyles}
`;

export default StackTrace;
