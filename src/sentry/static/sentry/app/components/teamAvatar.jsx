import PropTypes from 'prop-types';
import React from 'react';

import LetterAvatar from './letterAvatar';
import Tooltip from './tooltip';

class TeamAvatar extends React.Component {
  static propTypes = {
    team: PropTypes.object.isRequired,
    hasTooltip: PropTypes.bool,
  };

  static defaultProps = {
    className: 'avatar',
    hasTooltip: false,
  };

  getDisplayName = () => {
    let team = this.props.team;
    return team.slug;
  };

  render() {
    let {team, hasTooltip} = this.props;
    let displayName = this.getDisplayName();
    return (
      <span className={this.props.className}>
        <Tooltip title={displayName} disabled={!hasTooltip}>
          <LetterAvatar identifier={team.slug} displayName={displayName} />
        </Tooltip>
      </span>
    );
  }
}

export default TeamAvatar;
