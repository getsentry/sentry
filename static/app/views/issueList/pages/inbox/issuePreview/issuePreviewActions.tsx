import type {ReactNode} from 'react';
import {IconChevron} from '@sentry/icons/chevron';
import {IconCopy} from '@sentry/icons/copy';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {findBestThread} from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import {Placeholder} from 'sentry/components/placeholder';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import {EntryType, type Event, type Thread} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {GroupActions} from 'sentry/views/issueDetails/actions/index';
import {
  issueAndEventToMarkdown,
  useActiveThreadId,
} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';
import {
  PullRequestButtons,
  useIssuePreviewPullRequests,
} from 'sentry/views/issueList/pages/inbox/issuePreview/issuePreviewPullRequests';
import {useInvalidateInboxQueries} from 'sentry/views/issueList/pages/inbox/useInvalidateInboxQueries';

import {getCodingAgentLinks, type LocalCodingAgent} from './codingAgentLinks';
import {getIssueSummaryText, type IssueSummary} from './issuePreviewSummary';

interface CopyAsMarkdownDropdownProps {
  disabled: boolean;
  event: Event | undefined;
  group: Group;
  isEventLoading: boolean;
  autofixData?: ExplorerAutofixState | null;
  autofixFormatted?: string | null;
  summary?: IssueSummary;
}

interface IssuePreviewActionsProps extends CopyAsMarkdownDropdownProps {
  project: Project;
}

function CopyAsMarkdownDropdown({
  group,
  disabled,
  event,
  isEventLoading,
  autofixData,
  autofixFormatted,
  summary,
}: CopyAsMarkdownDropdownProps) {
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();
  const activeThreadId = useActiveThreadId();

  const {description, trace} = getIssueSummaryText(summary);
  const agentLinks = getCodingAgentLinks(group, description);

  function handleCopy() {
    const threads: Thread[] =
      event?.entries.find(entry => entry.type === EntryType.THREADS)?.data.values ?? [];
    let markdown = issueAndEventToMarkdown({
      group,
      event,
      organization,
      autofixData,
      autofixFormatted,
      activeThreadId: (
        threads.find(thread => thread.id === activeThreadId) ?? findBestThread(threads)
      )?.id,
    });
    if (description) {
      markdown += `\n\n## Summary\n\n${description}`;
    }
    if (trace) {
      markdown += `\n\n## In the trace\n\n${trace}`;
    }
    void copy(markdown, {
      successMessage: t('Copied issue to clipboard as Markdown'),
    });
  }

  const analyticsParams = {
    groupId: group.id,
    eventId: event?.id,
    hasAutofix: Boolean(autofixData),
  };
  const isDisabled = disabled || isEventLoading;
  const agents: Array<{icon: ReactNode; key: LocalCodingAgent; label: string}> = [
    {
      key: 'cursor',
      label: t('Open in Cursor'),
      icon: <PluginIcon pluginId="cursor" size={16} />,
    },
    {
      key: 'codex',
      label: t('Open in ChatGPT'),
      icon: <PluginIcon pluginId="codex" size={16} />,
    },
    {
      key: 'claude-code',
      label: t('Open in Claude Desktop'),
      icon: <PluginIcon pluginId="claude_code" size={16} />,
    },
  ];
  const agentItems: MenuItemProps[] = agents.map(({key, label, icon}) => ({
    key,
    label,
    leadingItems: icon,
    onAction: () => {
      trackAnalytics('issue_inbox.open_in_desktop_app_clicked', {
        organization,
        group_id: group.id,
        event_id: event?.id,
        agent: key,
      });
      testableWindowLocation.assign(agentLinks[key]);
    },
  }));

  return (
    <ButtonBar>
      <Button
        size="sm"
        variant="primary"
        icon={<IconCopy />}
        disabled={isDisabled}
        busy={!disabled && isEventLoading}
        onClick={handleCopy}
        analyticsEventKey="issue_details.copy_issue_details_as_markdown"
        analyticsEventName="Issue Details: Copy Issue Details as Markdown"
        analyticsParams={analyticsParams}
      >
        {t('Copy as Markdown')}
      </Button>
      <DropdownMenu
        size="sm"
        position="bottom-end"
        isDisabled={isDisabled}
        trigger={(triggerProps, isOpen) => (
          <OverlayTrigger.IconButton
            {...triggerProps}
            size="sm"
            variant="primary"
            disabled={isDisabled}
            icon={<IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />}
            aria-label={t('More issue context options')}
          />
        )}
        items={agentItems}
      />
    </ButtonBar>
  );
}

export function IssuePreviewActions({
  disabled,
  event,
  group,
  isEventLoading,
  project,
  autofixData,
  autofixFormatted,
  summary,
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
      <CopyAsMarkdownDropdown
        group={group}
        disabled={disabled}
        event={event}
        isEventLoading={isEventLoading}
        autofixData={autofixData}
        autofixFormatted={autofixFormatted}
        summary={summary}
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
        event={null}
        onUpdateSuccess={invalidateInboxQueries}
        resolveVariant="secondary"
      />
    </Flex>
  );
}
