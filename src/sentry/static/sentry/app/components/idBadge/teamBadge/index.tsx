import isEqual from 'lodash/isEqual';
import createReactClass from 'create-react-class';
import React from 'react';
import Reflux from 'reflux';

import SentryTypes from 'app/sentryTypes';
import TeamStore from 'app/stores/teamStore';
import {Team} from 'app/types';

import Badge from './badge';

type Props = React.ComponentProps<typeof Badge>;

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

  componentWillReceiveProps(nextProps: Props) {
    if (this.state.team === nextProps.team) {
      return;
    }

    if (isEqual(this.state.team, nextProps.team)) {
      return;
    }

    this.setState({team: nextProps.team});
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
    return <Badge {...this.props} team={this.state.team} />;
  },
});

export default TeamBadgeContainer;
