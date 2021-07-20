import ErrorBoundary from 'app/components/errorBoundary';
import rawStacktraceContent from 'app/components/events/interfaces/rawStacktraceContent';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import StacktraceContentV2 from 'app/components/events/interfaces/stacktraceContentV2';
import {PlatformType} from 'app/types';
import {Event} from 'app/types/event';
import {STACK_VIEW, StacktraceType} from 'app/types/stacktrace';

type Props = Pick<
  React.ComponentProps<typeof StacktraceContentV2>,
  'groupingCurrentLevel'
> & {
  stacktrace: StacktraceType;
  event: Event;
  newestFirst: boolean;
  platform: PlatformType;
  hasGroupingTreeUI: boolean;
  stackView?: STACK_VIEW;
};

const Stacktrace = ({
  stackView,
  stacktrace,
  event,
  newestFirst,
  platform,
  hasGroupingTreeUI,
  groupingCurrentLevel,
}: Props) => {
  return (
    <ErrorBoundary mini>
      {stackView === STACK_VIEW.RAW ? (
        <pre className="traceback plain">
          {rawStacktraceContent(stacktrace, event.platform)}
        </pre>
      ) : hasGroupingTreeUI ? (
        <StacktraceContentV2
          data={stacktrace}
          className="no-exception"
          includeSystemFrames={stackView === STACK_VIEW.FULL}
          platform={platform}
          event={event}
          newestFirst={newestFirst}
          groupingCurrentLevel={groupingCurrentLevel}
        />
      ) : (
        <StacktraceContent
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
};

export default Stacktrace;
