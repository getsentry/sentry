import {Flex} from '@sentry/scraps/layout';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {displayRawContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {NativeDisplayOptions} from 'sentry/components/stackTrace/native/nativeDisplayOptions';
import {RawDownloadAction} from 'sentry/components/stackTrace/native/rawDownloadAction';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useIssueThreadStackTraceContext} from './context';

export function IssueThreadStackTraceActions() {
  const organization = useOrganization();
  const {activeThreadModel, event, projectSlug} = useIssueThreadStackTraceContext();
  const {activeThread, minifiedStacktrace, platform, stacktrace} = activeThreadModel;
  const {isMinified} = useStackTraceViewState();

  const copyItems = CopyAsDropdown.makeDefaultCopyAsOptions({
    text: () => {
      const stacktraceData = isMinified ? (minifiedStacktrace ?? stacktrace) : stacktrace;

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
        platform={event.platform}
        projectSlug={projectSlug}
        threadId={activeThread?.id}
      />
      {stacktrace ? <NativeDisplayOptions /> : null}
      <CopyAsDropdown size="xs" items={copyItems} />
    </Flex>
  );
}
