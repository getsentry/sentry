import ErrorBoundary from 'app/components/errorBoundary';
import {PlatformType} from 'app/types';
import {Event} from 'app/types/event';
import {STACK_VIEW, StacktraceType} from 'app/types/stacktrace';

import Content from './content';
import ContentV2 from './contentV2';
import ContentV3 from './contentV3';
import rawStacktraceContent from './rawContent';

type Props = Pick<React.ComponentProps<typeof ContentV2>, 'groupingCurrentLevel'> & {
  stacktrace: StacktraceType;
  event: Event;
  newestFirst: boolean;
  platform: PlatformType;
  hasHierarchicalGrouping: boolean;
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
}: Props) {
  return (
    <ErrorBoundary mini>
      {stackView === STACK_VIEW.RAW ? (
        <pre className="traceback plain">
          {rawStacktraceContent(stacktrace, event.platform)}
        </pre>
      ) : nativeV2 ? (
        <ContentV3
          data={stacktrace}
          className="no-exception"
          includeSystemFrames={stackView === STACK_VIEW.FULL}
          platform={platform}
          event={event}
          newestFirst={newestFirst}
          groupingCurrentLevel={groupingCurrentLevel}
        />
      ) : hasHierarchicalGrouping ? (
        <ContentV2
          data={stacktrace}
          className="no-exception"
          includeSystemFrames={stackView === STACK_VIEW.FULL}
          platform={platform}
          event={event}
          newestFirst={newestFirst}
          groupingCurrentLevel={groupingCurrentLevel}
        />
      ) : (
        <Content
          data={stacktrace}
          className="no-exception"
          includeSystemFrames={stackView === STACK_VIEW.FULL}
          platform={platform}
          event={event}
          newestFirst={newestFirst}
        />
      )}
    </ErrorBoundary>
  );
}

export default StackTrace;
