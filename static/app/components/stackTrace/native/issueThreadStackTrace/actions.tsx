import {Flex} from '@sentry/scraps/layout';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {NativeDisplayOptions} from 'sentry/components/stackTrace/native/nativeDisplayOptions';
import {RawDownloadAction} from 'sentry/components/stackTrace/native/rawDownloadAction';
import {isNativePlatform} from 'sentry/utils/platform';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useActiveThreadContext, useIssueThreadStackTraceContext} from './context';

export function IssueThreadStackTraceActions() {
  const organization = useOrganization();
  const {event, projectSlug} = useIssueThreadStackTraceContext();
  const {activeThread, platform, stacktrace} = useActiveThreadContext();

  const copyItems = CopyAsDropdown.makeDefaultCopyAsOptions({
    text: () =>
      (activeThread?.stacktrace?.frames ?? [])
        .map(
          frame =>
            `  ${frame.instructionAddr ?? ''}  ${frame.function ?? ''}  (${frame.filename ?? ''})`
        )
        .join('\n'),
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
