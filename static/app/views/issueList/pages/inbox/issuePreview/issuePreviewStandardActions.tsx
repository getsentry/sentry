import {Flex} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {GroupActions} from 'sentry/views/issueDetails/actions/index';
import {
  PullRequestButtons,
  useIssuePreviewPullRequests,
} from 'sentry/views/issueList/pages/inbox/issuePreview/issuePreviewPullRequests';

export function IssuePreviewStandardActions({
  disabled,
  group,
  project,
}: {
  disabled: boolean;
  group: Group;
  project: Project;
}) {
  const {pullRequests, isPending} = useIssuePreviewPullRequests(group);

  return (
    <Flex align="center" gap="sm" wrap="wrap">
      {isPending ? (
        <Placeholder width="120px" height="32px" />
      ) : (
        <PullRequestButtons
          disabled={disabled}
          group={group}
          pullRequests={pullRequests}
        />
      )}
      <GroupActions
        group={group}
        project={project}
        disabled={disabled}
        event={null}
        resolveVariant={pullRequests.length > 0 ? 'secondary' : 'primary'}
      />
    </Flex>
  );
}
