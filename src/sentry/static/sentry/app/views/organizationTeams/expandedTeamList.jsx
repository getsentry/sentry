import React from 'react';
import {Link} from 'react-router';
import LazyLoad from 'react-lazy-load';

import ApiMixin from '../../mixins/apiMixin';
import BarChart from '../../components/barChart';
import ConfigStore from '../../stores/configStore';
import PropTypes from '../../proptypes';
import {sortArray} from '../../utils';
import {t, tct} from '../../locale';

const ExpandedTeamList = React.createClass({
  propTypes: {
    organization: PropTypes.Organization.isRequired,
    teamList: React.PropTypes.arrayOf(PropTypes.Team).isRequired,
    projectStats: React.PropTypes.object
  },

  mixins: [
    ApiMixin
  ],

  leaveTeam(team) {
    // TODO(dcramer): handle loading indicator
    this.api.leaveTeam({
      orgId: this.props.organization.slug,
      teamId: team.slug
    });
  },

  urlPrefix() {
    let org = this.props.organization;
    return ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;
  },

  renderProjectList(team) {
    return (
      <tbody>
        {sortArray(team.projects, function(o) {
          return o.name;
        }).map(this.renderProject)}
      </tbody>
    );
  },

  renderNoProjects(team) {
    return (
      <tbody>
        <tr>
          <td>
            <p className="project-list-empty">
              {tct('There are no projects in this team. Get started by [link:creating your first project].', {
                link: <a href={this.urlPrefix() + '/projects/new/?team=' + team.slug} />
              })}
            </p>
          </td>
        </tr>
      </tbody>
    );
  },

  renderTeamNode(team, urlPrefix) {
    // TODO: make this cleaner
    let access = this.props.access;
    let orgId = this.props.organization.slug;
    return (
      <div className="box" key={team.slug}>
        <div className="box-header">
          <div className="pull-right actions hidden-xs">
            <a className="leave-team" onClick={this.leaveTeam.bind(this, team)}>
              {t('Leave Team')}
            </a>
            {access.has('team:write') &&
              <Link className="team-settings" to={`/organizations/${orgId}/teams/${team.slug}/settings/`}>
                {t('Team Settings')}
              </Link>
            }
          </div>
          <h3>{team.name}</h3>
        </div>
        <div className="box-content">
          <table className="table project-list">
            {team.projects.length ?
              this.renderProjectList(team)
            :
              this.renderNoProjects(team)
            }
          </table>
        </div>
      </div>
    );
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
          {tct('You are not a member of any teams. [joinLink:Join an existing team] or [createLink:create a new one].', {
            joinLink: <a onClick={this.showAllTeams} />,
            createLink: <a href={this.urlPrefix() + '/teams/new/'} />
          })}
        </p>
      );

    }
    return (
      <p>
        {tct('You dont have any teams for this organization yet. Get started by [link:creating your first team].', {
          link: <a href={this.urlPrefix() + '/teams/new/'} />
        })}
      </p>
    );
  },

  renderTeamNodes() {
    return this.props.teamList.map((team) => {
      return this.renderTeamNode(team);
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
