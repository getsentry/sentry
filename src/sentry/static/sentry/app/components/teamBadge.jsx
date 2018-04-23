import {Flex} from 'grid-emotion';
import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import Avatar from './avatar';
import space from '../styles/space';
import SentryTypes from '../proptypes';

class TeamBadge extends React.Component {
  static propTypes = {
    team: SentryTypes.Team.isRequired,
    avatarSize: PropTypes.number,
    hideAvatar: PropTypes.bool,
    className: PropTypes.string,
  };

  static defaultProps = {
    avatarSize: 24,
    hideAvatar: false,
  };

  constructor(props) {
    super(props);
  }

  render() {
    let {className, team, hideAvatar, avatarSize} = this.props;

    return (
      <Flex align="center" className={className}>
        {!hideAvatar && <StyledAvatar team={team} size={avatarSize} />}
        #{team.slug}
      </Flex>
    );
  }
}

export default TeamBadge;

const StyledAvatar = styled(Avatar)`
  margin-right: ${space(1)};
`;
