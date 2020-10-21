import ErrorBoundary from 'app/components/errorBoundary';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import rawStacktraceContent from 'app/components/events/interfaces/rawStacktraceContent';
import {STACK_VIEW, StacktraceType} from 'app/types/stacktrace';
import {PlatformType, Event} from 'app/types';

type Props = {
  stackView: STACK_VIEW;
  stacktrace: StacktraceType;
  event: Event;
  newestFirst: boolean;
  platform: PlatformType;
};

const Stacktrace = ({stackView, stacktrace, event, newestFirst, platform}: Props) => (
  <ErrorBoundary mini>
    {stackView === STACK_VIEW.RAW ? (
      <pre className="traceback plain">
        {rawStacktraceContent(stacktrace, event.platform)}
      </pre>
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

export default Stacktrace;
