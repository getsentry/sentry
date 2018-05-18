import {isEqual} from 'lodash';
import createReactClass from 'create-react-class';
import React from 'react';
import Reflux from 'reflux';
import PropTypes from 'prop-types';

import BaseBadge from 'app/components/idBadge/baseBadge';
import BadgeDisplayName from 'app/components/idBadge/badgeDisplayName';
import SentryTypes from 'app/proptypes';
import TeamStore from 'app/stores/teamStore';

class TeamBadge extends React.Component {
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

const TeamBadgeContainer = createReactClass({
  displayName: 'TeamBadgeContainer',
  propTypes: {
    team: SentryTypes.Team.isRequired,
  },
  mixins: [Reflux.listenTo(TeamStore, 'onTeamStoreUpdate')],
  getInitialState() {
    return {
      team: this.props.team,
    };
  },

  componentWillReceiveProps(nextProps) {
    if (this.state.team === nextProps.team) return;
    if (isEqual(this.state.team, nextProps.team)) return;

    this.setState({
      team: nextProps.team,
    });
  },

  onTeamStoreUpdate(updatedTeam) {
    if (!updatedTeam.has(this.state.team.id)) return;

    let team = TeamStore.getById(this.state.team.id);
    if (isEqual(team.avatar, this.state.team.avatar)) return;

    this.setState({
      team: TeamStore.getById(this.state.team.id),
    });
  },

  render() {
    return <TeamBadge {...this.props} team={this.state.team} />;
  },
});
export default TeamBadgeContainer;
