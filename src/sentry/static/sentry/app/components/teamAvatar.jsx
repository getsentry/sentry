import classNames from 'classnames';
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
      <Tooltip title={displayName} disabled={!hasTooltip}>
        <span className={classNames('avatar', this.props.className)}>
          <LetterAvatar identifier={team.slug} displayName={displayName} />
        </span>
      </Tooltip>
    );
  }
}

export default TeamAvatar;
