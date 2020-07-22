import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {Team} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';
import TeamStore from 'app/stores/teamStore';

type InjectedTeamsProps = {
  teams: Team[];
};

type State = {
  teams: Team[];
  isLoading: boolean;
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
      return TeamStore.getState();
    },

    onTeamUpdate() {
      this.setState(TeamStore.getState());
    },

    render() {
      const {teams, isLoading} = this.state;
      return (
        <WrappedComponent {...(this.props as P)} teams={teams} isLoading={isLoading} />
      );
    },
  });
export default withTeams;
