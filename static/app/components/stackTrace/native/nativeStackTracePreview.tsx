import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {NativeIssueFrameActions} from 'sentry/components/stackTrace/native/frame/actions/nativeIssueActions';
import {NativeStackTraceFrames} from 'sentry/components/stackTrace/native/nativeStackTraceFrames';
import {NativeStackTraceProvider} from 'sentry/components/stackTrace/native/nativeStackTraceProvider';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';
import type {Event} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/platform';
import type {StacktraceType} from 'sentry/types/stacktrace';

interface NativeStackTracePreviewProps {
  event: Event;
  platform: PlatformKey;
  stacktrace: StacktraceType;
  groupingCurrentLevel?: number;
}

export function NativeStackTracePreview({
  event,
  groupingCurrentLevel,
  platform,
  stacktrace,
}: NativeStackTracePreviewProps) {
  return (
    <StackTraceViewStateProvider platform={platform}>
      <NativeStackTraceProvider
        collapseAll
        event={event}
        groupingCurrentLevel={groupingCurrentLevel}
        isHoverPreviewed
        platform={platform}
        stacktrace={stacktrace}
      >
        <NativeStackTraceFrames
          borderless
          frameActionsComponent={NativeIssueFrameActions}
          frameContextComponent={FrameContent}
        />
      </NativeStackTraceProvider>
    </StackTraceViewStateProvider>
  );
}
