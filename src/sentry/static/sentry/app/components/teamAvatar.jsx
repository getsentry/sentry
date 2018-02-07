import PropTypes from 'prop-types';
import React from 'react';

import LetterAvatar from './letterAvatar';
import Tooltip from './tooltip';

class TeamAvatar extends React.Component {
  static propTypes = {
    team: PropTypes.object.isRequired,
  };

  static defaultProps = {
    className: 'avatar',
  };

  getDisplayName = () => {
    let team = this.props.team;
    return team.name || team.slug;
  };

  render() {
    let {team} = this.props;
    let displayName = this.getDisplayName();
    return (
      <span className={this.props.className}>
        <Tooltip title={displayName}>
          <LetterAvatar identifier={team.slug} displayName={displayName} />
        </Tooltip>
      </span>
    );
  }
}

export default TeamAvatar;
