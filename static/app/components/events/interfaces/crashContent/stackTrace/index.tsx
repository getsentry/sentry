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
  hideIcon?: boolean;
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
  hideIcon,
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
        <ContentV3
          data={stacktrace}
          includeSystemFrames={stackView === STACK_VIEW.FULL}
          platform={platform}
          event={event}
          newestFirst={newestFirst}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta}
          hideIcon={hideIcon}
        />
      </ErrorBoundary>
    );
  }

  if (hasHierarchicalGrouping) {
    return (
      <ErrorBoundary mini>
        <ContentV2
          data={stacktrace}
          className="no-exception"
          includeSystemFrames={stackView === STACK_VIEW.FULL}
          platform={platform}
          event={event}
          newestFirst={newestFirst}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta}
          hideIcon={hideIcon}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary mini>
      <Content
        data={stacktrace}
        className="no-exception"
        includeSystemFrames={stackView === STACK_VIEW.FULL}
        platform={platform}
        event={event}
        newestFirst={newestFirst}
        meta={meta}
        hideIcon={hideIcon}
      />
    </ErrorBoundary>
  );
}

export default StackTrace;
