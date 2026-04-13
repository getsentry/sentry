import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CommitLink} from 'sentry/components/commitLink';
import {TimeSince} from 'sentry/components/timeSince';
import {Version} from 'sentry/components/version';
import {VersionHoverCard} from 'sentry/components/versionHoverCard';
import {t, tct} from 'sentry/locale';
import type {GroupActivity, ResolvedStatusDetails} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Repository} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

type Props = {
  activities: GroupActivity[];
  project: Project;
  // TODO(ts): This should be a union type `IgnoredStatusDetails | ResolvedStatusDetails`
  statusDetails: ResolvedStatusDetails;
};

export function ResolutionReason({statusDetails, project, activities}: Props) {
  const organization = useOrganization();
  const actor = statusDetails.actor ? (
    <strong>
      <span>{statusDetails.actor.name}</span>
    </strong>
  ) : null;

  const relevantActivity = activities.find(
    activity => activity.type === GroupActivityType.SET_RESOLVED_IN_RELEASE
  );

  const integrationName = relevantActivity?.sentry_app?.name ?? null;
  const resolvedActor = integrationName ? <strong>{integrationName}</strong> : actor;

  // Resolved in next release has current_release_version (semver only)
  if (relevantActivity && 'current_release_version' in relevantActivity.data) {
    const releaseVersion =
      statusDetails.inRelease ?? relevantActivity.data.current_release_version;
    const version = (
      <VersionHoverCard
        organization={organization}
        projectSlug={project.slug}
        releaseVersion={releaseVersion}
      >
        <StyledVersion version={releaseVersion} projectId={project.id} />
      </VersionHoverCard>
    );
    return resolvedActor
      ? tct('[actor] marked this issue as resolved in versions greater than [version].', {
          actor: resolvedActor,
          version,
        })
      : tct(
          'This issue has been marked as resolved in versions greater than [version].',
          {
            version,
          }
        );
  }

  if (statusDetails.inNextRelease) {
    return resolvedActor
      ? tct('[actor] marked this issue as resolved in the upcoming release.', {
          actor: resolvedActor,
        })
      : t('This issue has been marked as resolved in the upcoming release.');
  }
  if (statusDetails.inRelease) {
    const version = (
      <VersionHoverCard
        organization={organization}
        projectSlug={project.slug}
        releaseVersion={statusDetails.inRelease}
      >
        <StyledVersion version={statusDetails.inRelease} projectId={project.id} />
      </VersionHoverCard>
    );
    return resolvedActor
      ? tct('[actor] marked this issue as resolved in version [version].', {
          actor: resolvedActor,
          version,
        })
      : tct('This issue has been marked as resolved in version [version].', {version});
  }
  if (statusDetails.inCommit) {
    return tct('This issue has been marked as resolved by [commit]', {
      commit: (
        <Fragment>
          <StyledCommitLink
            inline
            showIcon={false}
            commitId={statusDetails.inCommit.id}
            repository={statusDetails.inCommit.repository as Repository}
          />
          {statusDetails.inCommit.dateCreated && (
            <Fragment>
              {'('}
              <StyledTimeSince date={statusDetails.inCommit.dateCreated} />
              {')'}
            </Fragment>
          )}
        </Fragment>
      ),
    });
  }
  return null;
}

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.colors.green500};
  font-size: inherit;
  text-decoration-style: dotted;
  text-decoration-color: ${p => p.theme.colors.green500};
`;

const StyledVersion = styled(Version)`
  color: ${p => p.theme.colors.green500};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  text-decoration: underline;
  text-decoration-style: dotted;
  &:hover {
    color: ${p => p.theme.colors.green500};
    text-decoration: none;
  }
`;

const StyledCommitLink = styled(CommitLink)`
  color: ${p => p.theme.colors.green500};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  text-decoration: underline;
  text-decoration-style: dotted;
  margin-right: ${p => p.theme.space.xs};
  &:hover {
    color: ${p => p.theme.colors.green500};
    text-decoration: none;
  }
`;
