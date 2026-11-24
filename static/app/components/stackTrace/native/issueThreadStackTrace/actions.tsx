import {displayRawContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {IssueStackTraceActions} from 'sentry/components/stackTrace/issueStackTrace/issueStackTraceActions';
import {
  formatExceptionsAsText,
  getOrderedExceptions,
} from 'sentry/components/stackTrace/issueStackTrace/utils';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {isNativePlatform} from 'sentry/utils/platform';

import {useIssueThreadStackTraceContext} from './context';

export function IssueThreadStackTraceActions() {
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
  const displayedStacktraces = exception?.values.length
    ? exception.values.map(value =>
        isMinified ? (value.rawStacktrace ?? value.stacktrace) : value.stacktrace
      )
    : [isMinified ? (minifiedStacktrace ?? stacktrace) : stacktrace];

  const copyText = () => {
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
  };

  return (
    <IssueStackTraceActions
      copyText={copyText}
      event={event}
      frames={displayedStacktraces.flatMap(trace => trace?.frames ?? [])}
      isNative={isNativePlatform(platform)}
      projectSlug={projectSlug}
      threadId={activeThread?.id}
    />
  );
}
