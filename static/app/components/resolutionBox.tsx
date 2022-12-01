import {Fragment} from 'react';
import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import CommitLink from 'sentry/components/commitLink';
import {BannerContainer, BannerSummary} from 'sentry/components/events/styles';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  GroupActivity,
  GroupActivitySetByResolvedInRelease,
  GroupActivityType,
  Repository,
  ResolutionStatusDetails,
} from 'sentry/types';

type Props = {
  projectId: string;
  statusDetails: ResolutionStatusDetails;
  activities?: GroupActivity[];
};

function renderReason(
  statusDetails: ResolutionStatusDetails,
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
  ) as GroupActivitySetByResolvedInRelease | undefined;

  const currentReleaseVersion = relevantActivity?.data.current_release_version!;

  if (statusDetails.inNextRelease && statusDetails.actor) {
    return tct('[actor] marked this issue as resolved in the upcoming release.', {
      actor,
    });
  }
  if (statusDetails.inNextRelease) {
    return t('This issue has been marked as resolved in the upcoming release.');
  }
  if (statusDetails.inRelease && statusDetails.actor) {
    return currentReleaseVersion
      ? tct('[actor] marked this issue as resolved in versions greater than [version].', {
          actor,
          version: (
            <Version
              version={currentReleaseVersion}
              projectId={projectId}
              tooltipRawVersion
            />
          ),
        })
      : tct('[actor] marked this issue as resolved in version [version].', {
          actor,
          version: (
            <Version
              version={statusDetails.inRelease}
              projectId={projectId}
              tooltipRawVersion
            />
          ),
        });
  }
  if (statusDetails.inRelease) {
    return currentReleaseVersion
      ? tct(
          'This issue has been marked as resolved in versions greater than [version].',
          {
            version: (
              <Version
                version={currentReleaseVersion}
                projectId={projectId}
                tooltipRawVersion
              />
            ),
          }
        )
      : tct('This issue has been marked as resolved in version [version].', {
          version: (
            <Version
              version={statusDetails.inRelease}
              projectId={projectId}
              tooltipRawVersion
            />
          ),
        });
  }
  if (statusDetails.inCommit) {
    return tct('This issue has been marked as resolved by [commit]', {
      commit: (
        <Fragment>
          <CommitLink
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
