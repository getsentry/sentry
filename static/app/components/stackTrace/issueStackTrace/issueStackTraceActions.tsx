import {Flex} from '@sentry/scraps/layout';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {DisplayOptions} from 'sentry/components/stackTrace/displayOptions';
import {NativeDisplayOptionsMenu} from 'sentry/components/stackTrace/native/nativeDisplayOptions';
import {getNativeFrameCapabilities} from 'sentry/components/stackTrace/native/nativeFrameAnalysis';
import {RawDownloadAction} from 'sentry/components/stackTrace/native/rawDownloadAction';
import type {Event, Frame} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

interface IssueStackTraceActionsProps {
  copyText: () => string;
  event: Event;
  /** Frames on screen, used to enable the native frame detail toggles. */
  frames: Frame[];
  isNative: boolean;
  projectSlug: Project['slug'] | undefined;
  threadId?: number;
}

/** Download, Display, and Copy as actions for an issue stack trace section. */
export function IssueStackTraceActions({
  copyText,
  event,
  frames,
  isNative,
  projectSlug,
  threadId,
}: IssueStackTraceActionsProps) {
  const organization = useOrganization();

  return (
    <Flex align="center" gap="sm">
      {isNative && projectSlug ? (
        <RawDownloadAction
          eventId={event.id}
          organization={organization}
          platform={event.platform}
          projectSlug={projectSlug}
          threadId={threadId}
        />
      ) : null}
      {isNative ? (
        <NativeDisplayOptionsMenu {...getNativeFrameCapabilities(frames)} />
      ) : (
        <DisplayOptions />
      )}
      <CopyAsDropdown
        size="xs"
        items={CopyAsDropdown.makeDefaultCopyAsOptions({
          text: copyText,
          json: undefined,
          markdown: undefined,
        })}
      />
    </Flex>
  );
}
