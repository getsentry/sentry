import React from 'react';

import ErrorBoundary from 'app/components/errorBoundary';
import rawStacktraceContent from 'app/components/events/interfaces/rawStacktraceContent';
import StacktraceContent from 'app/components/events/interfaces/stacktraceContent';
import {Event, PlatformType} from 'app/types';
import {STACK_VIEW, StacktraceType} from 'app/types/stacktrace';

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
