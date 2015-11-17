import React from 'react';
import {Link} from 'react-router';
import LazyLoad from 'react-lazy-load';

import api from '../../api';
import BarChart from '../../components/barChart';
import ConfigStore from '../../stores/configStore';
import PropTypes from '../../proptypes';
import {sortArray} from '../../utils';

const ExpandedTeamList = React.createClass({
  propTypes: {
    organization: PropTypes.Organization.isRequired,
    teamList: React.PropTypes.arrayOf(PropTypes.Team).isRequired,
    projectStats: React.PropTypes.object
  },

  leaveTeam(team) {
    // TODO(dcramer): handle loading indicator
    api.leaveTeam({
      orgId: this.props.organization.slug,
      teamId: team.slug
    });
  },

  urlPrefix() {
    let org = this.props.organization;
    return ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;
  },

  renderTeamNode(team, urlPrefix) {
    // TODO: make this cleaner
    if (team.projects.length) {
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
    } else {
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
              <tbody>
                <tr>
                  <td>
                    <p className="project-list-empty">
                      {'There are no projects in this team. Get started by '}
                      <a href={this.urlPrefix() + '/projects/new/?team=' + team.slug}>creating your first project</a>.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }
  },

  renderProject(project) {
    let org = this.props.organization;
    let projectStats = this.props.projectStats;
    let chartData = null;
    if (projectStats[project.id]) {
      chartData = projectStats[project.id].map((point) => {
        return {x: point[0], y: point[1]};
      });
    }

    return (
      <tr key={project.id}>
        <td>
          <h5>
            <Link to={`/${org.slug}/${project.slug}/`}>
              {project.name}
            </Link>
          </h5>
        </td>
        <td className="align-right project-chart">
          {chartData && <LazyLoad><BarChart points={chartData} className="sparkline" /></LazyLoad> }
        </td>
      </tr>
    );
  },

  showAllTeams(e) {
    e.preventDefault();
    this.props.showAllTeams();
  },

  renderEmpty() {
    if (this.props.hasTeams) {
      return (
        <p>
          {'You are not a member of any teams. '}
          <a onClick={this.showAllTeams}>Join an existing team</a>
          {' or '}
          <a href={this.urlPrefix() + '/teams/new/'}>create a new one</a>
          {'.'}
        </p>
      );

    }
    return (
      <p>
        {'You dont have any teams for this organization yet. Get started by '}
        <a href={this.urlPrefix() + '/teams/new/'}>creating your first team</a>.
      </p>
    );
  },

  renderTeamNodes() {
    let urlPrefix = this.urlPrefix();
    return this.props.teamList.map((team) => {
      return this.renderTeamNode(team, urlPrefix);
    });
  },

  render() {
    let hasTeams = this.props.teamList.length > 0;

    return (
      <div>
        {hasTeams ? this.renderTeamNodes() : this.renderEmpty() }
      </div>
    );
  }
});

export default ExpandedTeamList;
