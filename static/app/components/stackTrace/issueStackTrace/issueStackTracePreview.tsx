import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import type {Event} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';

import {IssueFrameActions} from './issueFrameActions';

export function IssueStackTracePreview({
  event,
  stacktrace,
}: {
  event: Event;
  stacktrace: StacktraceType;
}) {
  return (
    <StackTraceViewStateProvider platform={event.platform}>
      <StackTraceProvider event={event} stacktrace={stacktrace} collapseAll>
        <StackTraceFrames
          borderless
          frameActionsComponent={IssueFrameActions}
          frameContextComponent={FrameContent}
        />
      </StackTraceProvider>
    </StackTraceViewStateProvider>
  );
}
