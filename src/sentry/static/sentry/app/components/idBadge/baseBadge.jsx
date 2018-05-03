import {Flex} from 'grid-emotion';
import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import Avatar from 'app/components/avatar';
import space from 'app/styles/space';
import SentryTypes from 'app/proptypes';

class BaseBadge extends React.Component {
  static propTypes = {
    team: SentryTypes.Team,
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    /**
     * Avatar size
     */
    avatarSize: PropTypes.number,
    /**
     * Hides the avatar
     */
    hideAvatar: PropTypes.bool,
    /**
     * Hides the main display name
     */
    hideName: PropTypes.bool,
    className: PropTypes.string,
    displayName: PropTypes.node,
    avatarClassName: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  };

  static defaultProps = {
    avatarSize: 24,
    hideAvatar: false,
  };

  render() {
    let {
      className,
      hideAvatar,
      hideName,
      avatarSize,
      avatarClassName,
      displayName,
      team,
      organization,
      project,
    } = this.props;

    let data = {
      team,
      organization,
      project,
    };

    return (
      <Flex align="center" className={className}>
        {!hideAvatar && (
          <StyledAvatar css={avatarClassName} size={avatarSize} {...data} />
        )}
        {!hideName && displayName}
      </Flex>
    );
  }
}

export default BaseBadge;

const StyledAvatar = styled(Avatar)`
  margin-right: ${space(1)};
  flex-shrink: 0;
`;
