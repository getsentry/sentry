import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import TeamStore from 'app/stores/teamStore';
import {Team} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedTeamsProps = {
  teams: Team[];
};

type State = {
  teams: Team[];
};

/**
 * Higher order component that uses TeamStore and provides a list of teams
 */
const withTeams = <P extends InjectedTeamsProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<Omit<P, keyof InjectedTeamsProps>, State>({
    displayName: `withTeams(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(TeamStore, 'onTeamUpdate') as any],

    getInitialState() {
      return {
        teams: TeamStore.getAll(),
      };
    },

    onTeamUpdate() {
      this.setState({
        teams: TeamStore.getAll(),
      });
    },
    render() {
      return (
        <WrappedComponent {...(this.props as P)} teams={this.state.teams as Team[]} />
      );
    },
  });

export default withTeams;
