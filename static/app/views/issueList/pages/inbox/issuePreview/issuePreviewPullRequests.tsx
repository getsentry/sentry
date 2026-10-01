import {LinkButton} from '@sentry/scraps/button';

import {
  partitionLinkedPullRequests,
  useLinkedPullRequests,
} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {LinkedPullRequest} from 'sentry/types/integrations';

export function useIssuePreviewPullRequests(group: Group) {
  const {data, isPending} = useLinkedPullRequests({group});
  const {currentPullRequests} = partitionLinkedPullRequests(
    data?.pullRequests ?? [],
    data?.latestRegressionAt
  );
  const pullRequests = currentPullRequests
    .filter(
      pullRequest => pullRequest.status === 'open' || pullRequest.status === 'draft'
    )
    .sort((a, b) => Date.parse(b.dateCreated) - Date.parse(a.dateCreated));

  return {pullRequests, isPending};
}

export function PullRequestButtons({
  disabled,
  group,
  pullRequests,
}: {
  group: Group;
  pullRequests: LinkedPullRequest[];
  disabled?: boolean;
}) {
  return pullRequests.slice(0, 2).map((pullRequest, index) => (
    <LinkButton
      key={pullRequest.externalUrl}
      size="sm"
      analyticsEventKey="issue_inbox.seer_cta_clicked"
      analyticsEventName="Issue Inbox: Seer CTA Clicked"
      analyticsParams={{
        group_id: group.id,
        progress: group.derivedData?.progress,
        destination: 'pull_request',
      }}
      external
      disabled={disabled}
      href={pullRequest.externalUrl}
      icon={<IconGithub data-test-id="pull-request-github" />}
      variant={index === 0 ? 'primary' : 'secondary'}
    >
      {pullRequests.length > 1 ? t('View PR #%s', pullRequest.id) : t('View PR')}
    </LinkButton>
  ));
}
