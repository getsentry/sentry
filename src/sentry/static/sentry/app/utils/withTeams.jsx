import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import TeamStore from '../stores/teamStore';
import SentryTypes from '../proptypes';

/**
 * Higher order component that uses TeamStore and provides a list of teams
 */
const withTeams = WrappedComponent =>
  createReactClass({
    displayName: 'withTeams',
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
      return <WrappedComponent {...this.props} teams={this.state.teams} />;
    },
  });

export default withTeams;
