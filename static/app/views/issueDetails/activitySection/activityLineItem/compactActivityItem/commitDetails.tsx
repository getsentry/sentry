import moment from 'moment-timezone';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct, tn} from 'sentry/locale';
import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {BaseRelease} from 'sentry/types/release';
import {CommitChip} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/commitChip';
import {getCommitRepository} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/commitRepository';
import {ActivityRelease} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/releaseChip';
import {getProviderName} from 'sentry/views/issueDetails/activitySection/activityLineItem/compactActivityItem/provider';

const MAX_OTHER_RELEASES_IN_TOOLTIP = 5;

function ReleaseOverflow({releases}: {releases: BaseRelease[]}) {
  const count = releases.length;
  const visibleReleases = releases.slice(0, MAX_OTHER_RELEASES_IN_TOOLTIP);
  const hiddenCount = count - visibleReleases.length;

  return (
    <Tooltip
      skipWrapper
      maxWidth={320}
      title={
        <Stack gap="xs">
          {visibleReleases.map(release => (
            <Text key={release.version} as="span" size="sm" ellipsis>
              {release.version}
            </Text>
          ))}
          {hiddenCount > 0 ? (
            <Text as="span" size="sm" variant="muted">
              {tn('+%s more release', '+%s more releases', hiddenCount)}
            </Text>
          ) : null}
        </Stack>
      }
    >
      <Text as="span" density="comfortable" variant="muted">
        {tn('%s other', '%s others', count)}
      </Text>
    </Tooltip>
  );
}

export function getResolvedInCommitDetails(
  activity: Extract<GroupActivity, {type: GroupActivityType.SET_RESOLVED_IN_COMMIT}>,
  organization: Organization,
  project: Project
) {
  const commit = activity.data.commit;
  if (!commit) {
    return t('in a commit');
  }

  const deployedReleases = (commit.releases || [])
    .filter(release => release.dateReleased !== null)
    .sort((a, b) => moment(a.dateReleased).valueOf() - moment(b.dateReleased).valueOf());
  const firstRelease = deployedReleases[0];
  const repository = getCommitRepository(commit);
  const provider = getProviderName(
    repository?.provider?.name ?? repository?.provider?.id
  );
  const commitChip = <CommitChip commit={commit} />;

  if (!firstRelease) {
    return tct('by [commit] on [provider]', {
      commit: commitChip,
      provider,
    });
  }

  const releaseChip = (
    <ActivityRelease
      organization={organization}
      project={project}
      version={firstRelease.version}
    />
  );
  const otherReleases = deployedReleases.slice(1);

  if (otherReleases.length === 0) {
    return tct('by [commit] on [provider], released in [release]', {
      commit: commitChip,
      provider,
      release: releaseChip,
    });
  }

  return tct('by [commit] on [provider], released in [release] and [otherReleases]', {
    commit: commitChip,
    otherReleases: <ReleaseOverflow releases={otherReleases} />,
    provider,
    release: releaseChip,
  });
}
