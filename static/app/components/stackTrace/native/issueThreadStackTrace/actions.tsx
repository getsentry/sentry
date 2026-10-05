import {Flex} from '@sentry/scraps/layout';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {displayRawContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {DisplayOptions} from 'sentry/components/stackTrace/displayOptions';
import {
  formatExceptionsAsText,
  getOrderedExceptions,
} from 'sentry/components/stackTrace/issueStackTrace/utils';
import {NativeDisplayOptionsMenu} from 'sentry/components/stackTrace/native/nativeDisplayOptions';
import {getNativeFrameCapabilities} from 'sentry/components/stackTrace/native/nativeFrameAnalysis';
import {RawDownloadAction} from 'sentry/components/stackTrace/native/rawDownloadAction';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {isNativePlatform} from 'sentry/utils/platform';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useIssueThreadStackTraceContext} from './context';

export function IssueThreadStackTraceActions() {
  const organization = useOrganization();
  const {activeThreadModel, event, projectSlug} = useIssueThreadStackTraceContext();
  const {
    activeThread,
    exception,
    minifiedStacktrace,
    platform,
    stacktrace,
    textExceptionValues,
  } = activeThreadModel;
  const {isMinified, isNewestFirst, view} = useStackTraceViewState();
  const isNativeStackTrace = isNativePlatform(platform);
  const displayedStacktraces = exception?.values.length
    ? exception.values.map(value =>
        isMinified ? (value.rawStacktrace ?? value.stacktrace) : value.stacktrace
      )
    : [isMinified ? (minifiedStacktrace ?? stacktrace) : stacktrace];
  const frames = displayedStacktraces.flatMap(trace => trace?.frames ?? []);
  const displayOptions = displayedStacktraces.some(Boolean) ? (
    isNativeStackTrace ? (
      <NativeDisplayOptionsMenu {...getNativeFrameCapabilities(frames)} />
    ) : (
      <DisplayOptions />
    )
  ) : null;

  const copyItems = CopyAsDropdown.makeDefaultCopyAsOptions({
    text: () => {
      if (textExceptionValues) {
        return formatExceptionsAsText({
          exceptions: getOrderedExceptions(textExceptionValues, isNewestFirst, view),
          platform,
          isMinified,
          isStandalone: false,
        });
      }

      const threadStacktrace = isMinified
        ? (activeThread?.rawStacktrace ?? activeThread?.stacktrace)
        : activeThread?.stacktrace;

      if (!threadStacktrace) {
        return '';
      }

      const threadInfo = activeThread?.name ? `Thread: ${activeThread.name}\n` : '';
      return (
        threadInfo +
        displayRawContent({
          data: threadStacktrace,
          platform: threadStacktrace.frames?.[0]?.platform ?? platform,
          isMinified,
        })
      );
    },
    json: undefined,
    markdown: undefined,
  });

  return (
    <Flex align="center" gap="sm">
      {isNativeStackTrace ? (
        <RawDownloadAction
          eventId={event.id}
          organization={organization}
          platform={event.platform}
          projectSlug={projectSlug}
          threadId={activeThread?.id}
        />
      ) : null}
      {displayOptions}
      <CopyAsDropdown size="xs" items={copyItems} />
    </Flex>
  );
}
