import React from 'react';
import isEqual from 'lodash/isEqual';

import TeamStore from 'app/stores/teamStore';
import {Team} from 'app/types';

import Badge from './badge';

type Props = React.ComponentProps<typeof Badge>;

type State = {
  team: Team;
};

class TeamBadgeContainer extends React.Component<Props, State> {
  state: State = {team: this.props.team};

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (this.state.team === nextProps.team) {
      return;
    }

    if (isEqual(this.state.team, nextProps.team)) {
      return;
    }

    this.setState({team: nextProps.team});
  }

  componentWillUnmount() {
    this.unlistener?.();
  }

  unlistener = TeamStore.listen(
    (team: Set<string>) => this.onTeamStoreUpdate(team),
    undefined
  );

  onTeamStoreUpdate(updatedTeam: Set<string>) {
    if (!updatedTeam.has(this.state.team.id)) {
      return;
    }

    const team = TeamStore.getById(this.state.team.id);
    if (!team || isEqual(team.avatar, this.state.team.avatar)) {
      return;
    }

    this.setState({team});
  }

  render() {
    return <Badge {...this.props} team={this.state.team} />;
  }
}

export default TeamBadgeContainer;
