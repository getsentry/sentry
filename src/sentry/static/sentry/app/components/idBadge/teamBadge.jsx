import React from 'react';
import PropTypes from 'prop-types';

import BaseBadge from 'app/components/idBadge/baseBadge';
import SentryTypes from 'app/proptypes';
import BadgeDisplayName from 'app/components/idBadge/badgeDisplayName';

export default class TeamBadge extends React.Component {
  static propTypes = {
    ...BaseBadge.propTypes,
    team: SentryTypes.Team.isRequired,
    avatarSize: PropTypes.number,
    /**
     * If true, will use default max-width, or specify one as a string
     */
    hideOverflow: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    hideAvatar: PropTypes.bool,
  };

  static defaultProps = {
    avatarSize: 24,
    hideOverflow: true,
    hideAvatar: false,
  };

  render() {
    let {hideOverflow, team, ...props} = this.props;

    return (
      <BaseBadge
        displayName={
          <BadgeDisplayName hideOverflow={hideOverflow}>#{team.slug}</BadgeDisplayName>
        }
        team={team}
        {...props}
      />
    );
  }
}
