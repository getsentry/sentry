import React from 'react';

import ConfigStore from '../../stores/configStore';
import PropTypes from '../../proptypes';

import AllTeamsRow from './allTeamsRow';

const AllTeamsList = React.createClass({
  propTypes: {
    organization: PropTypes.Organization.isRequired,
    teamList: React.PropTypes.arrayOf(PropTypes.Team).isRequired,
    openMembership: React.PropTypes.bool
  },

  render() {
    let {organization, openMembership} = this.props;
    let urlPrefix = ConfigStore.get('urlPrefix') + '/organizations/' + organization.slug;

    let teamNodes = this.props.teamList.map((team, teamIdx) => {
      return (
        <AllTeamsRow
          team={team}
          organization={organization}
          openMembership={openMembership}
          key={team.slug} />
      );
    });

    if (teamNodes.length !== 0) {
      return (
        <table className="table">
          <tbody>
            {teamNodes}
          </tbody>
        </table>
      );
    }
    return (
      <p>You dont have any teams for this organization yet. Get started by <a href={urlPrefix + '/teams/new/'}>creating your first team</a>.</p>
    );
  }
});

export default AllTeamsList;
