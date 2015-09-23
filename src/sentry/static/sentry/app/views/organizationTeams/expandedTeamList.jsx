import React from "react";
import Router from "react-router";

import api from "../../api";
import BarChart from "../../components/barChart";
import ConfigStore from "../../stores/configStore";
import PropTypes from "../../proptypes";
import {sortArray} from "../../utils";

var ExpandedTeamList = React.createClass({
  propTypes: {
    organization: PropTypes.Organization.isRequired,
    teamList: React.PropTypes.arrayOf(PropTypes.Team).isRequired,
    projectStats: React.PropTypes.object
  },

  contextTypes: {
    router: React.PropTypes.func
  },

  leaveTeam(team) {
    // TODO(dcramer): handle loading indicator
    api.leaveTeam({
      orgId: this.props.organization.slug,
      teamId: team.slug
    });
  },

  urlPrefix() {
    var org = this.props.organization;
    return ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;
  },

  renderTeamNode(team, urlPrefix) {
    return (
      <div className="box" key={team.slug}>
        <div className="box-header">
          <div className="pull-right actions hidden-xs">
            <a className="leave-team" onClick={this.leaveTeam.bind(this, team)}>
              Leave Team
            </a>
            <a className="team-settings" href={urlPrefix + '/teams/' + team.slug + '/settings/'}>
              Team Settings
            </a>
          </div>
          <h3>{team.name}</h3>
        </div>
        <div className="box-content">
          <table className="table project-list">
            <tbody>{sortArray(team.projects, function(o) {
              return o.name;
            }).map(this.renderProject)}</tbody>
          </table>
        </div>
      </div>
    );
  },

  renderProject(project) {
    var org = this.props.organization;
    var projectStats = this.props.projectStats;
    var chartData = null;
    if (projectStats[project.id]) {
      chartData = projectStats[project.id].map((point) => {
        return {x: point[0], y: point[1]};
      });
    }

    return (
      <tr key={project.id}>
        <td>
          <h5>
            <Router.Link to="projectDetails"
                params={{orgId: org.slug, projectId: project.slug}}>
              {project.name}
            </Router.Link>
          </h5>
        </td>
        <td className="align-right project-chart">
          {chartData && <BarChart points={chartData} className="sparkline" /> }
        </td>
      </tr>
    );
  },

  renderEmpty() {
    return (
      <p>
        {"You dont have any teams for this organization yet. Get started by "}
        <a href={this.urlPrefix() + '/teams/new/'}>creating your first team</a>.
      </p>
    );
  },

  renderTeamNodes() {
    var urlPrefix = this.urlPrefix();
    return this.props.teamList.map((team) => {
      return this.renderTeamNode(team, urlPrefix);
    });
  },

  render() {
    var hasTeams = this.props.teamList.length > 0;

    return (
      <div>
        {hasTeams ? this.renderTeamNodes() : this.renderEmpty() }
      </div>
    );
  }
});

export default ExpandedTeamList;
