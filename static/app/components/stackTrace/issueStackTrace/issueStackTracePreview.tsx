import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {IssueFrameActions} from 'sentry/components/stackTrace/issueStackTrace/issueFrameActions';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import type {Event} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';

export function IssueStackTracePreview({
  event,
  stacktrace,
}: {
  event: Event;
  stacktrace: StacktraceType;
}) {
  return (
    <StackTraceViewStateProvider platform={event.platform}>
      <StackTraceProvider event={event} stacktrace={stacktrace}>
        <StackTraceFrames
          borderless
          frameActionsComponent={IssueFrameActions}
          frameContextComponent={FrameContent}
        />
      </StackTraceProvider>
    </StackTraceViewStateProvider>
  );
}
