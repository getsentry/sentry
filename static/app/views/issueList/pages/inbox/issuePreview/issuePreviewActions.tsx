import type {ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {findBestThread} from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import {Placeholder} from 'sentry/components/placeholder';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {GroupActions} from 'sentry/views/issueDetails/actions/index';
import {issueAndEventToMarkdown} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';
import {
  PullRequestButtons,
  useIssuePreviewPullRequests,
} from 'sentry/views/issueList/pages/inbox/issuePreview/issuePreviewPullRequests';
import {useInvalidateInboxQueries} from 'sentry/views/issueList/pages/inbox/useInvalidateInboxQueries';

interface CopyAsMarkdownButtonProps {
  disabled: boolean;
  group: Group;
  autofixData?: ExplorerAutofixState | null;
  autofixFormatted?: string | null;
}

interface IssuePreviewActionsProps {
  disabled: boolean;
  group: Group;
  project: Project;
  autofixData?: ExplorerAutofixState | null;
  autofixFormatted?: string | null;
}

function CopyAsMarkdownButton({
  group,
  disabled,
  autofixData,
  autofixFormatted,
}: CopyAsMarkdownButtonProps) {
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();
  const {data: event, isPending} = useGroupEvent({
    groupId: group.id,
    eventId: 'recommended',
    options: {enabled: !disabled},
  });

  function handleCopy() {
    const threads =
      event?.entries.find(entry => entry.type === EntryType.THREADS)?.data.values ?? [];
    void copy(
      issueAndEventToMarkdown({
        group,
        event,
        organization,
        autofixData,
        autofixFormatted,
        activeThreadId: findBestThread(threads)?.id,
      }),
      {successMessage: t('Copied issue to clipboard as Markdown')}
    );
  }

  return (
    <Button
      size="sm"
      variant="primary"
      icon={<IconCopy />}
      disabled={disabled || isPending}
      busy={!disabled && isPending}
      onClick={handleCopy}
      analyticsEventKey="issue_details.copy_issue_details_as_markdown"
      analyticsEventName="Issue Details: Copy Issue Details as Markdown"
      analyticsParams={{
        groupId: group.id,
        eventId: event?.id,
        hasAutofix: Boolean(autofixData),
      }}
    >
      {t('Copy as Markdown')}
    </Button>
  );
}

export function IssuePreviewActions({
  disabled,
  group,
  project,
  autofixData,
  autofixFormatted,
}: IssuePreviewActionsProps) {
  const {pullRequests, isPending} = useIssuePreviewPullRequests(group);
  const invalidateInboxQueries = useInvalidateInboxQueries(group.id);
  let primaryAction: ReactNode;
  if (isPending) {
    primaryAction = <Placeholder width="120px" height="32px" />;
  } else if (pullRequests.length > 0) {
    primaryAction = (
      <PullRequestButtons disabled={disabled} group={group} pullRequests={pullRequests} />
    );
  } else {
    primaryAction = (
      <CopyAsMarkdownButton
        group={group}
        disabled={disabled}
        autofixData={autofixData}
        autofixFormatted={autofixFormatted}
      />
    );
  }

  return (
    <Flex
      role="group"
      aria-label={t('Issue actions')}
      align="center"
      gap="sm"
      wrap="wrap"
    >
      {primaryAction}
      <GroupActions
        group={group}
        project={project}
        disabled={disabled}
        event={null}
        onUpdateSuccess={invalidateInboxQueries}
        resolveVariant="secondary"
      />
    </Flex>
  );
}
