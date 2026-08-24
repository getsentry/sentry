import {ErrorBoundary} from 'sentry/components/errorBoundary';
import type {Event} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/platform';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {StackView} from 'sentry/types/stacktrace';
import {isNativePlatform} from 'sentry/utils/platform';

import {Content} from './content';
import {NativeContent} from './nativeContent';
import {displayRawContent as rawStacktraceContent} from './rawContent';

type Props = {
  event: Event;
  newestFirst: boolean;
  platform: PlatformKey;
  stackView: StackView;
  stacktrace: StacktraceType;
  groupingCurrentLevel?: number;
  lockAddress?: string;
  meta?: Record<any, any>;
  threadId?: number;
};

export function StackTraceContent({
  stackView,
  stacktrace,
  event,
  newestFirst,
  platform,
  groupingCurrentLevel,
  meta,
  threadId,
  lockAddress,
}: Props) {
  if (stackView === StackView.RAW) {
    return (
      <ErrorBoundary mini>
        <pre className="traceback plain">
          {rawStacktraceContent({data: stacktrace, platform: event.platform})}
        </pre>
      </ErrorBoundary>
    );
  }

  if (isNativePlatform(platform)) {
    return (
      <ErrorBoundary mini>
        <NativeContent
          data={stacktrace}
          includeSystemFrames={stackView === StackView.FULL}
          platform={platform}
          event={event}
          newestFirst={newestFirst}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary mini>
      <Content
        data={stacktrace}
        className="no-exception"
        includeSystemFrames={stackView === StackView.FULL}
        platform={platform}
        event={event}
        newestFirst={newestFirst}
        meta={meta}
        threadId={threadId}
        lockAddress={lockAddress}
      />
    </ErrorBoundary>
  );
}
