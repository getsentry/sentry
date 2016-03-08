import React from 'react';

import ConfigStore from '../../stores/configStore';
import PropTypes from '../../proptypes';

import AllTeamsRow from './allTeamsRow';
import {tct} from '../../locale';

const AllTeamsList = React.createClass({
  propTypes: {
    access: React.PropTypes.object,
    organization: PropTypes.Organization,
    teamList: React.PropTypes.arrayOf(PropTypes.Team),
    openMembership: React.PropTypes.bool
  },

  render() {
    let {access, organization, openMembership} = this.props;
    let teamNodes = this.props.teamList.map((team, teamIdx) => {
      return (
        <AllTeamsRow
          access={access}
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

    let urlPrefix = `${ConfigStore.get('urlPrefix')}/organizations/${organization.slug}`;
    return tct('You don\'t have any teams for this organization yet. Get started by [link:creating your first team].', {
      root: <p />,
      link: <a href={`${urlPrefix}/teams/new/`} />
    });
  }
});

export default AllTeamsList;
