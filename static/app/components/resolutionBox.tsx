import {Fragment} from 'react';
import styled from '@emotion/styled';

import CommitLink from 'sentry/components/commitLink';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {BannerContainer, BannerSummary} from 'sentry/components/events/styles';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {GroupActivity, ResolvedStatusDetails} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Repository} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

type Props = {
  organization: Organization;
  project: Project;
  // TODO(ts): This should be a union type `IgnoredStatusDetails | ResolvedStatusDetails`
  statusDetails: ResolvedStatusDetails;
  activities?: GroupActivity[];
};

export function renderResolutionReason({
  statusDetails,
  project,
  organization,
  activities = [],
  hasStreamlinedUI = false,
}: Props & {hasStreamlinedUI?: boolean}) {
  const VersionComponent = hasStreamlinedUI ? StreamlinedVersion : Version;
  const CommitLinkComponent = hasStreamlinedUI ? StreamlinedCommitLink : CommitLink;

  const actor = statusDetails.actor ? (
    <strong>
      {!hasStreamlinedUI && (
        <UserAvatar user={statusDetails.actor} size={20} className="avatar" />
      )}
      <span style={{marginLeft: hasStreamlinedUI ? 0 : 5}}>
        {statusDetails.actor.name}
      </span>
    </strong>
  ) : null;

  const relevantActivity = activities.find(
    activity => activity.type === GroupActivityType.SET_RESOLVED_IN_RELEASE
  );

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
        <VersionComponent version={releaseVersion} projectId={project.id} />
      </VersionHoverCard>
    );
    return statusDetails.actor
      ? tct('[actor] marked this issue as resolved in versions greater than [version].', {
          actor,
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
    return actor
      ? tct('[actor] marked this issue as resolved in the upcoming release.', {
          actor,
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
        <VersionComponent version={statusDetails.inRelease} projectId={project.id} />
      </VersionHoverCard>
    );
    return actor
      ? tct('[actor] marked this issue as resolved in version [version].', {
          actor,
          version,
        })
      : tct('This issue has been marked as resolved in version [version].', {version});
  }
  if (statusDetails.inCommit) {
    return tct('This issue has been marked as resolved by [commit]', {
      commit: (
        <Fragment>
          <CommitLinkComponent
            inline
            showIcon={false}
            commitId={statusDetails.inCommit.id}
            repository={statusDetails.inCommit.repository as Repository}
          />
          {statusDetails.inCommit.dateCreated &&
            (hasStreamlinedUI ? (
              <Fragment>
                {'('}
                <StreamlinedTimeSince date={statusDetails.inCommit.dateCreated} />
                {')'}
              </Fragment>
            ) : (
              <StyledTimeSince date={statusDetails.inCommit.dateCreated} />
            ))}
        </Fragment>
      ),
    });
  }
  return hasStreamlinedUI ? null : t('This issue has been marked as resolved.');
}

function ResolutionBox(props: Props) {
  return (
    <BannerContainer priority="default">
      <BannerSummary>
        <StyledIconCheckmark variant="success" />
        <span>{renderResolutionReason(props)}</span>
      </BannerSummary>
    </BannerContainer>
  );
}

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.subText};
  margin-left: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.sm};
`;

const StreamlinedTimeSince = styled(TimeSince)`
  color: ${p => p.theme.colors.green500};
  font-size: inherit;
  text-decoration-style: dotted;
  text-decoration-color: ${p => p.theme.colors.green500};
`;

const StyledIconCheckmark = styled(IconCheckmark)`
  /* override margin defined in BannerSummary */
  margin-top: 0 !important;
  align-self: center;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    margin-top: ${space(0.5)} !important;
    align-self: flex-start;
  }
`;

const StreamlinedVersion = styled(Version)`
  color: ${p => p.theme.colors.green500};
  font-weight: ${p => p.theme.fontWeight.bold};
  text-decoration: underline;
  text-decoration-style: dotted;
  &:hover {
    color: ${p => p.theme.colors.green500};
    text-decoration: none;
  }
`;

const StreamlinedCommitLink = styled(CommitLink)`
  color: ${p => p.theme.colors.green500};
  font-weight: ${p => p.theme.fontWeight.bold};
  text-decoration: underline;
  text-decoration-style: dotted;
  margin-right: ${space(0.5)};
  &:hover {
    color: ${p => p.theme.colors.green500};
    text-decoration: none;
  }
`;

export default ResolutionBox;
