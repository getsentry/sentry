import {IconGithub} from '@sentry/icons/iconGithub';

import {LinkButton} from '@sentry/scraps/button';

import {
  partitionLinkedPullRequests,
  useLinkedPullRequests,
} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {LinkedPullRequest} from 'sentry/types/integrations';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';

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
      analyticsEventKey="issue_details.external_issue_pull_request_clicked"
      analyticsEventName="Issue Details: External Issue Pull Request Clicked"
      analyticsParams={{
        ...getAnalyticsDataForGroup(group),
        progress: group.derivedData?.progress,
        attribution_agent: pullRequest.attribution?.agent,
        attribution_type: pullRequest.attribution?.type,
        checks_status: pullRequest.checksStatus,
        review_status: pullRequest.reviewStatus,
        pull_request_id: pullRequest.id,
        pull_request_status: pullRequest.status,
        repository_id: pullRequest.repository.id,
        repository_provider: pullRequest.repository.provider.id,
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
