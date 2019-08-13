import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import SentryTypes from 'app/sentryTypes';
import TeamStore from 'app/stores/teamStore';
import {Team} from 'app/types';

/**
 * Higher order component that uses TeamStore and provides a list of teams
 */
const withTeams = <P extends object>(WrappedComponent: React.ComponentType<P>) =>
  createReactClass({
    displayName: `withTeams(${getDisplayName(WrappedComponent)})`,
    propTypes: {
      organization: SentryTypes.Organization,
    },
    mixins: [Reflux.listenTo(TeamStore, 'onTeamUpdate')],
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
      return <WrappedComponent {...this.props as P} teams={this.state.teams as Team[]} />;
    },
  });

export default withTeams;
