import {t, tct} from 'sentry/locale';
import type {GroupActivity, ResolvedStatusDetails} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {CommitChip} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/commitChip';
import {PullRequestChip} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/pullRequestChip';
import {ActivityRelease} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/releaseChip';

type Props = {
  activities: GroupActivity[];
  project: Project;
  statusDetails: ResolvedStatusDetails;
};

export function ActivityResolutionReason({statusDetails, project, activities}: Props) {
  const organization = useOrganization();
  const resolvedInReleaseActivity = activities.find(
    (
      activity
    ): activity is Extract<
      GroupActivity,
      {type: GroupActivityType.SET_RESOLVED_IN_RELEASE}
    > => activity.type === GroupActivityType.SET_RESOLVED_IN_RELEASE
  );
  const resolvedInCommitActivity = activities.find(
    (
      activity
    ): activity is Extract<
      GroupActivity,
      {type: GroupActivityType.SET_RESOLVED_IN_COMMIT}
    > => activity.type === GroupActivityType.SET_RESOLVED_IN_COMMIT
  );

  const activityActor =
    resolvedInReleaseActivity?.sentry_app?.name ??
    statusDetails.actor?.name ??
    resolvedInReleaseActivity?.user?.name;
  const pullRequest = resolvedInReleaseActivity?.data.commit?.pullRequest;

  // Resolved in next release has current_release_version (semver only)
  if (
    resolvedInReleaseActivity &&
    'current_release_version' in resolvedInReleaseActivity.data
  ) {
    const release = (
      <ActivityRelease
        organization={organization}
        project={project}
        version={resolvedInReleaseActivity.data.current_release_version}
      />
    );
    return activityActor
      ? tct('[actor] resolved starting with a release after [release]', {
          actor: activityActor,
          release,
        })
      : tct('Resolved starting with a release after [release]', {release});
  }

  if (statusDetails.inRelease) {
    const release = (
      <ActivityRelease
        organization={organization}
        project={project}
        version={statusDetails.inRelease}
      />
    );

    if (!pullRequest) {
      return activityActor
        ? tct('[actor] resolved in [release]', {actor: activityActor, release})
        : tct('Resolved in [release]', {release});
    }

    const values = {
      pullRequest: <PullRequestChip pullRequest={pullRequest} />,
      release,
    };

    return activityActor
      ? tct('[actor] resolved via [pullRequest] released in [release]', {
          actor: activityActor,
          ...values,
        })
      : tct('Via [pullRequest] released in [release]', values);
  }

  if (statusDetails.inNextRelease) {
    return activityActor
      ? tct('[actor] set this to resolve in the upcoming release', {
          actor: activityActor,
        })
      : t('Set to resolve in the upcoming release');
  }

  if (statusDetails.inCommit && resolvedInCommitActivity?.data.commit) {
    const commit = resolvedInCommitActivity.data.commit;
    const commitActor =
      resolvedInCommitActivity.sentry_app?.name ??
      statusDetails.actor?.name ??
      resolvedInCommitActivity.user?.name;
    const source = commit.pullRequest ? (
      <PullRequestChip pullRequest={commit.pullRequest} />
    ) : (
      <CommitChip commit={commit} />
    );
    return commitActor
      ? tct('[actor] resolved via [source]', {actor: commitActor, source})
      : tct('Resolved via [source]', {source});
  }

  return null;
}
