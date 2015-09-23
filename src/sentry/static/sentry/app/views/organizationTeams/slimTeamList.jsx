import React from "react";

import api from "../../api";
import ConfigStore from "../../stores/configStore";
import PropTypes from "../../proptypes";

var SlimTeamList = React.createClass({
  propTypes: {
    organization: PropTypes.Organization.isRequired,
    teamList: React.PropTypes.arrayOf(PropTypes.Team).isRequired,
    openMembership: React.PropTypes.bool
  },

  joinTeam(team) {
    // TODO(dcramer): handle 'requested' case and loading indicator
    api.joinTeam({
      orgId: this.props.organization.slug,
      teamId: team.slug
    });
  },

  leaveTeam(team) {
    // TODO(dcramer): handle loading indicator
    api.leaveTeam({
      orgId: this.props.organization.slug,
      teamId: team.slug
    });
  },

  render() {
    var org = this.props.organization;
    var urlPrefix = ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;

    var teamNodes = this.props.teamList.map((team, teamIdx) => {
      return (
        <tr key={team.slug}>
          <td>
            <h5>{team.name}</h5>
          </td>
          <td className="actions align-right">
            {team.isMember ?
              <a className="leave-team btn btn-default btn-sm"
                 onClick={this.leaveTeam.bind(this, team)}>Leave Team</a>
            : (team.isPending ?
              <a className="join-team btn btn-default btn-sm">Request Pending</a>
            : (this.props.openMembership ?
              <a className="join-team btn btn-default btn-sm"
                 onClick={this.joinTeam.bind(this, team)}>Join Team</a>
            :
              <a className="join-team btn btn-default btn-sm"
                 onClick={this.joinTeam.bind(this, team)}>Request Access</a>
            ))}
          </td>
        </tr>
      );
    });

    if (teamNodes.length !== 0) {
      return (
        <table className="table">
          {teamNodes}
        </table>
      );
    }
    return (
      <p>You dont have any teams for this organization yet. Get started by <a href={urlPrefix + '/teams/new/'}>creating your first team</a>.</p>
    );
  }
});

export default SlimTeamList;
