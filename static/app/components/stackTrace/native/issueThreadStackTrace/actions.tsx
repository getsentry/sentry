import {Flex} from '@sentry/scraps/layout';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {displayRawContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {DisplayOptions} from 'sentry/components/stackTrace/displayOptions';
import {getOrderedExceptions} from 'sentry/components/stackTrace/issueStackTrace/utils';
import {NativeDisplayOptions} from 'sentry/components/stackTrace/native/nativeDisplayOptions';
import {RawDownloadAction} from 'sentry/components/stackTrace/native/rawDownloadAction';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {isNativePlatform} from 'sentry/utils/platform';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useIssueThreadStackTraceContext} from './context';

export function IssueThreadStackTraceActions() {
  const organization = useOrganization();
  const {activeThreadModel, event, projectSlug} = useIssueThreadStackTraceContext();
  const {
    activeException,
    activeThread,
    exception,
    minifiedStacktrace,
    platform,
    stacktrace,
  } = activeThreadModel;
  const {isMinified, isNewestFirst, view} = useStackTraceViewState();
  const isNativeStackTrace = isNativePlatform(platform);
  const displayOptions = stacktrace ? (
    isNativeStackTrace ? (
      <NativeDisplayOptions />
    ) : (
      <DisplayOptions />
    )
  ) : null;

  const copyItems = CopyAsDropdown.makeDefaultCopyAsOptions({
    text: () => {
      const threadInfo = activeThread?.name ? `Thread: ${activeThread.name}\n` : '';

      if (exception?.values?.length) {
        const exceptions = getOrderedExceptions(exception.values, isNewestFirst, view);
        const activeExceptionIndex = activeException
          ? exception.values.indexOf(activeException)
          : -1;

        return (
          threadInfo +
          exceptions
            .map(exc => {
              const isActiveException = exc.exceptionIndex === activeExceptionIndex;
              let stacktraceData = exc.stacktrace;

              if (isMinified) {
                stacktraceData = isActiveException
                  ? (minifiedStacktrace ?? exc.rawStacktrace ?? exc.stacktrace)
                  : (exc.rawStacktrace ?? exc.stacktrace);
              } else if (isActiveException) {
                stacktraceData = stacktrace ?? exc.stacktrace;
              }

              return displayRawContent({
                data: stacktraceData,
                platform: stacktraceData.frames?.[0]?.platform ?? platform,
                exception: exc,
                isMinified,
              });
            })
            .join('\n\n')
        );
      }

      const stacktraceData = isMinified ? (minifiedStacktrace ?? stacktrace) : stacktrace;

      if (!stacktraceData) {
        return '';
      }

      return (
        threadInfo +
        displayRawContent({
          data: stacktraceData,
          platform: stacktraceData.frames?.[0]?.platform ?? platform,
          hasSimilarityEmbeddingsFeature: false,
          includeLocation: true,
          rawTrace: true,
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
