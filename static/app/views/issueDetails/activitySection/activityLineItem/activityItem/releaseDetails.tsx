import {Fragment} from 'react';

import {t, tct} from 'sentry/locale';
import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Commit} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {CommitChip} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/commitChip';
import {getIntegrationChip} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/integrationChip';
import {PullRequestChip} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/pullRequestChip';
import {ActivityRelease} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/releaseChip';

function getReleaseResolutionSource(commit: Commit | null | undefined) {
  if (commit?.pullRequest) {
    return tct(' via [pullRequest]', {
      pullRequest: <PullRequestChip pullRequest={commit.pullRequest} />,
    });
  }

  if (commit) {
    return tct(' via [commit]', {
      commit: <CommitChip commit={commit} />,
    });
  }

  return null;
}

export function getResolvedInReleaseDetails(
  activity: Extract<GroupActivity, {type: GroupActivityType.SET_RESOLVED_IN_RELEASE}>,
  organization: Organization,
  project: Project
) {
  const {data} = activity;
  const integrationChip = getIntegrationChip({data, organization});
  const resolutionSource = (
    <Fragment>
      {getReleaseResolutionSource(data.commit)}
      {integrationChip && tct(' via [integration]', {integration: integrationChip})}
    </Fragment>
  );

  if ('current_release_version' in data) {
    return (
      <Fragment>
        {tct('starting with a release after [version]', {
          version: (
            <ActivityRelease
              organization={organization}
              project={project}
              version={data.current_release_version}
            />
          ),
        })}
        {resolutionSource}
      </Fragment>
    );
  }

  if (data.version) {
    return (
      <Fragment>
        {tct('in [version]', {
          version: (
            <ActivityRelease
              organization={organization}
              project={project}
              version={data.version}
            />
          ),
        })}
        {resolutionSource}
      </Fragment>
    );
  }

  return (
    <Fragment>
      {t('in the upcoming release')}
      {resolutionSource}
    </Fragment>
  );
}
