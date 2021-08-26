import * as React from 'react';

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
function withTeams<P extends InjectedTeamsProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithTeams extends React.Component<Omit<P, keyof InjectedTeamsProps>, State> {
    static displayName = `withTeams(${getDisplayName(WrappedComponent)})`;

    state = {
      teams: TeamStore.getAll(),
    };

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = TeamStore.listen(
      () => this.setState({teams: TeamStore.getAll()}),
      undefined
    );

    render() {
      return (
        <WrappedComponent {...(this.props as P)} teams={this.state.teams as Team[]} />
      );
    }
  }
  return WithTeams;
}

export default withTeams;
