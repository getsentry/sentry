import {Flex} from '@sentry/scraps/layout';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {displayRawContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {NativeDisplayOptions} from 'sentry/components/stackTrace/native/nativeDisplayOptions';
import {RawDownloadAction} from 'sentry/components/stackTrace/native/rawDownloadAction';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {isNativePlatform} from 'sentry/utils/platform';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useActiveThreadContext, useIssueThreadStackTraceContext} from './context';

export function IssueThreadStackTraceActions() {
  const organization = useOrganization();
  const {event, projectSlug} = useIssueThreadStackTraceContext();
  const {activeThread, platform, stacktrace} = useActiveThreadContext();
  const {isMinified} = useStackTraceViewState();

  const copyItems = CopyAsDropdown.makeDefaultCopyAsOptions({
    text: () => {
      const stacktraceData = isMinified
        ? (activeThread?.rawStacktrace ?? activeThread?.stacktrace)
        : activeThread?.stacktrace;

      if (!stacktraceData) {
        return '';
      }

      const threadInfo = activeThread?.name ? `Thread: ${activeThread.name}\n` : '';

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
      <RawDownloadAction
        eventId={event.eventID}
        organization={organization}
        projectSlug={projectSlug}
        threadId={activeThread?.id}
      />
      {stacktrace && isNativePlatform(platform) ? <NativeDisplayOptions /> : null}
      <CopyAsDropdown size="xs" items={copyItems} />
    </Flex>
  );
}
