import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import UserAvatar from 'app/components/avatar/userAvatar';
import {BannerContainer, BannerSummary} from 'app/components/events/styles';
import CommitLink from 'app/components/commitLink';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import {IconCheckmark} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray2};
  margin-left: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default class ResolutionBox extends React.Component {
  static propTypes = {
    statusDetails: PropTypes.object.isRequired,
  };

  renderReason = () => {
    const {statusDetails} = this.props;
    const actor = statusDetails.actor ? (
      <strong>
        <UserAvatar user={statusDetails.actor} size={20} className="avatar" />
        <span style={{marginLeft: 5}}>{statusDetails.actor.name}</span>
      </strong>
    ) : null;

    if (statusDetails.inNextRelease && statusDetails.actor) {
      return tct('[actor] marked this issue as resolved in the upcoming release.', {
        actor,
      });
    } else if (statusDetails.inNextRelease) {
      return t('This issue has been marked as resolved in the upcoming release.');
    } else if (statusDetails.inRelease && statusDetails.actor) {
      return tct('[actor] marked this issue as resolved in version [version].', {
        actor,
        version: <Version version={statusDetails.inRelease} tooltipRawVersion />,
      });
    } else if (statusDetails.inRelease) {
      return tct('This issue has been marked as resolved in version [version].', {
        version: <Version version={statusDetails.inRelease} tooltipRawVersion />,
      });
    } else if (!!statusDetails.inCommit) {
      return tct('This issue has been marked as resolved by [commit]', {
        commit: (
          <React.Fragment>
            <CommitLink
              commitId={statusDetails.inCommit.id}
              repository={statusDetails.inCommit.repository}
            />
            <StyledTimeSince date={statusDetails.inCommit.dateCreated} />
          </React.Fragment>
        ),
      });
    }
    return t('This issue has been marked as resolved.');
  };

  render = () => {
    return (
      <BannerContainer priority="default">
        <BannerSummary>
          <IconCheckmark color={theme.green} />
          <span>{this.renderReason()}</span>
        </BannerSummary>
      </BannerContainer>
    );
  };
}
