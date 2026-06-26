import moment from 'moment-timezone';

import {CommitLink} from 'sentry/components/commitLink';
import {t, tct} from 'sentry/locale';
import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Commit} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {ActivityRelease} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/releaseChip';

function CommitActivityLink({commit}: {commit: Commit}) {
  return <CommitLink inline commitId={commit.id} repository={commit.repository} />;
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

  if (deployedReleases.length === 1 && firstRelease) {
    return tct('in [commit], released in [release]', {
      commit: <CommitActivityLink commit={commit} />,
      release: (
        <ActivityRelease
          organization={organization}
          project={project}
          version={firstRelease.version}
        />
      ),
    });
  }

  if (deployedReleases.length > 1 && firstRelease) {
    return tct('in [commit], released in [release] and [otherCount] others', {
      commit: <CommitActivityLink commit={commit} />,
      otherCount: deployedReleases.length - 1,
      release: (
        <ActivityRelease
          organization={organization}
          project={project}
          version={firstRelease.version}
        />
      ),
    });
  }

  return tct('in [commit]', {
    commit: <CommitActivityLink commit={commit} />,
  });
}
