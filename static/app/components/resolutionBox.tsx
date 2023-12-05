import {Fragment} from 'react';
import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import CommitLink from 'sentry/components/commitLink';
import {BannerContainer, BannerSummary} from 'sentry/components/events/styles';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  GroupActivity,
  GroupActivitySetByResolvedInNextSemverRelease,
  GroupActivitySetByResolvedInRelease,
  GroupActivityType,
  Repository,
  ResolvedStatusDetails,
} from 'sentry/types';

type Props = {
  projectId: string;
  // TODO(ts): This should be a union type `IgnoredStatusDetails | ResolvedStatusDetails`
  statusDetails: ResolvedStatusDetails;
  activities?: GroupActivity[];
};

function renderReason(
  statusDetails: ResolvedStatusDetails,
  projectId: string,
  activities: GroupActivity[]
) {
  const actor = statusDetails.actor ? (
    <strong>
      <UserAvatar user={statusDetails.actor} size={20} className="avatar" />
      <span style={{marginLeft: 5}}>{statusDetails.actor.name}</span>
    </strong>
  ) : null;

  const relevantActivity = activities.find(
    activity => activity.type === GroupActivityType.SET_RESOLVED_IN_RELEASE
  ) as
    | GroupActivitySetByResolvedInRelease
    | GroupActivitySetByResolvedInNextSemverRelease
    | undefined;

  if (statusDetails.inNextRelease) {
    // Resolved in next release has current_release_version (semver only)
    if (relevantActivity && 'current_release_version' in relevantActivity.data) {
      const version = (
        <Version
          version={relevantActivity.data.current_release_version}
          projectId={projectId}
          tooltipRawVersion
        />
      );
      return statusDetails.actor
        ? tct(
            '[actor] marked this issue as resolved in versions greater than [version].',
            {
              actor,
              version,
            }
          )
        : tct(
            'This issue has been marked as resolved in versions greater than [version].',
            {version}
          );
    }

    return actor
      ? tct('[actor] marked this issue as resolved in the upcoming release.', {
          actor,
        })
      : t('This issue has been marked as resolved in the upcoming release.');
  }
  if (statusDetails.inRelease) {
    const version = (
      <Version
        version={statusDetails.inRelease}
        projectId={projectId}
        tooltipRawVersion
      />
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
          <CommitLink
            inline
            showIcon={false}
            commitId={statusDetails.inCommit.id}
            repository={statusDetails.inCommit.repository as Repository}
          />
          {statusDetails.inCommit.dateCreated && (
            <StyledTimeSince date={statusDetails.inCommit.dateCreated} />
          )}
        </Fragment>
      ),
    });
  }
  return t('This issue has been marked as resolved.');
}

function ResolutionBox({statusDetails, projectId, activities = []}: Props) {
  return (
    <BannerContainer priority="default">
      <BannerSummary>
        <StyledIconCheckmark color="successText" />
        <span>{renderReason(statusDetails, projectId, activities)}</span>
      </BannerSummary>
    </BannerContainer>
  );
}

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray300};
  margin-left: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledIconCheckmark = styled(IconCheckmark)`
  /* override margin defined in BannerSummary */
  margin-top: 0 !important;
  align-self: center;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-top: ${space(0.5)} !important;
    align-self: flex-start;
  }
`;

export default ResolutionBox;
