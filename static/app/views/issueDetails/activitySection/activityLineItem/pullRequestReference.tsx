import {Stack} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {
  PullRequestList,
  useLinkedPullRequests,
} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import {Placeholder} from 'sentry/components/placeholder';
import type {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {
  GroupActivityType,
  type Group,
  type GroupActivity,
  type GroupActivitySetByResolvedInPullRequest,
} from 'sentry/types/group';
import type {LinkedPullRequest} from 'sentry/types/integrations';

import type {ActivityFeedItem} from './activityFeedItem';
import {ActivityLine} from '.';

export function isPullRequestReferenceActivity(
  activity: GroupActivity
): activity is GroupActivitySetByResolvedInPullRequest {
  return activity.type === GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST;
}

/**
 * A "referenced in pull request" row with the linked pull request shown below it.
 */
export function ActivityLinePullRequestReference({
  activity,
  group,
  item,
  timestampUnitStyle,
}: {
  activity: GroupActivitySetByResolvedInPullRequest;
  group: Group;
  item: ActivityFeedItem;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}) {
  const {data, isPending} = useLinkedPullRequests({group});
  const externalUrl = activity.data.pullRequest?.externalUrl;
  const pullRequest = externalUrl
    ? data?.pullRequests.find(linked => linked.externalUrl === externalUrl)
    : undefined;
  const showLinkedPullRequest = isPending ? !!externalUrl : !!pullRequest;

  return (
    <ActivityLine item={item} group={group} timestampUnitStyle={timestampUnitStyle}>
      {showLinkedPullRequest ? (
        <Stack gap="sm" paddingTop={item.body ? undefined : 'sm'}>
          {item.body}
          <LinkedPullRequestContent group={group} pullRequest={pullRequest} />
        </Stack>
      ) : (
        item.body
      )}
    </ActivityLine>
  );
}

function LinkedPullRequestContent({
  group,
  pullRequest,
}: {
  group: Group;
  pullRequest: LinkedPullRequest | undefined;
}) {
  if (!pullRequest) {
    return <Placeholder height="78px" />;
  }

  return (
    <ErrorBoundary mini>
      <PullRequestList
        ariaLabel={t('Linked pull requests')}
        group={group}
        pullRequests={[pullRequest]}
        variant="default"
      />
    </ErrorBoundary>
  );
}
