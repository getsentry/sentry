import React from 'react';
import {Link} from 'react-router';
import LazyLoad from 'react-lazy-load';

import ApiMixin from '../../mixins/apiMixin';
import {update as projectUpdate} from '../../actionCreators/projects';
import BarChart from '../../components/barChart';
import ProjectLabel from '../../components/projectLabel';
import ConfigStore from '../../stores/configStore';
import PropTypes from '../../proptypes';
import TooltipMixin from '../../mixins/tooltip';
import {sortArray} from '../../utils';
import {t, tct} from '../../locale';

const ExpandedTeamList = React.createClass({
  propTypes: {
    access: React.PropTypes.object.isRequired,
    organization: PropTypes.Organization.isRequired,
    teamList: React.PropTypes.arrayOf(PropTypes.Team).isRequired,
    projectStats: React.PropTypes.object,
    hasTeams: React.PropTypes.bool
  },

  mixins: [
    ApiMixin,
    TooltipMixin(function () {
      return {
        selector: '.tip',
        title: function (instance) {
          return (this.getAttribute('data-isbookmarked') === 'true' ?
            'Remove from bookmarks' : 'Add to bookmarks');
        }
      };
    })
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

  toggleBookmark(project) {
    projectUpdate(this.api, {
      orgId: this.props.organization.slug,
      projectId: project.slug,
      data: {
        isBookmarked: !project.isBookmarked
      }
    });
  },

  renderProject(project) {
    let org = this.props.organization;
    let chartData = project.stats && project.stats.map(point => {
      return {x: point[0], y: point[1]};
    });

    return (
      <tr key={project.id} className={project.isBookmarked ? 'isBookmarked' : null}>
        <td>
          <h5>
            <a onClick={this.toggleBookmark.bind(this, project)}
               className="tip"
               data-isbookmarked={project.isBookmarked}>
              {project.isBookmarked ? <span className="icon-star-solid bookmark" /> : <span className="icon-star-outline bookmark" />}
            </a>
            <Link to={`/${org.slug}/${project.slug}/`}>
              <ProjectLabel project={project} organization={this.props.organization}/>
            </Link>
          </h5>
        </td>
        <td className="align-right project-chart">
          {chartData && <LazyLoad><BarChart points={chartData} className="sparkline" /></LazyLoad> }
        </td>
      </tr>
    );
  },

  renderEmpty() {
    if (this.props.hasTeams) {
      return (
        <p>
          {tct('You are not a member of any teams. [joinLink:Join an existing team] or [createLink:create a new one].', {
            joinLink: <Link to={`/organizations/${this.props.organization.slug}/all-teams/`}/>,
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
