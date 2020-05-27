import isEqual from 'lodash/isEqual';
import createReactClass from 'create-react-class';
import React from 'react';
import Reflux from 'reflux';
import PropTypes from 'prop-types';

import BaseBadge from 'app/components/idBadge/baseBadge';
import BadgeDisplayName from 'app/components/idBadge/badgeDisplayName';
import TeamAvatar from 'app/components/avatar/teamAvatar';
import SentryTypes from 'app/sentryTypes';
import TeamStore from 'app/stores/teamStore';
import {Team} from 'app/types';

type DefaultProps = {
  avatarSize: TeamAvatar['props']['size'];
  // If true, will use default max-width, or specify one as a string
  hideOverflow: boolean | string;
  hideAvatar: boolean;
};

type Props = DefaultProps & {
  team: Team;
  className?: string;
};

class TeamBadge extends React.Component<Props> {
  static propTypes = {
    ...BaseBadge.propTypes,
    team: SentryTypes.Team.isRequired,
    avatarSize: PropTypes.number,
    hideOverflow: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    hideAvatar: PropTypes.bool,
  };

  static defaultProps: DefaultProps = {
    avatarSize: 24,
    hideOverflow: true,
    hideAvatar: false,
  };

  render() {
    const {hideOverflow, team, ...props} = this.props;

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

type ContainerState = {
  team: Team;
};

const TeamBadgeContainer = createReactClass<Props, ContainerState>({
  displayName: 'TeamBadgeContainer',
  propTypes: {
    team: SentryTypes.Team.isRequired,
  },
  mixins: [Reflux.listenTo(TeamStore, 'onTeamStoreUpdate') as any],
  getInitialState() {
    return {
      team: this.props.team,
    };
  },

  componentWillReceiveProps(nextProps) {
    if (this.state.team === nextProps.team) {
      return;
    }
    if (isEqual(this.state.team, nextProps.team)) {
      return;
    }

    this.setState({
      team: nextProps.team,
    });
  },

  onTeamStoreUpdate(updatedTeam: Set<string>) {
    if (!updatedTeam.has(this.state.team.id)) {
      return;
    }

    const team = TeamStore.getById(this.state.team.id);
    if (!team || isEqual(team.avatar, this.state.team.avatar)) {
      return;
    }

    this.setState({team});
  },

  render() {
    return <TeamBadge {...this.props} team={this.state.team} />;
  },
});

export default TeamBadgeContainer;
