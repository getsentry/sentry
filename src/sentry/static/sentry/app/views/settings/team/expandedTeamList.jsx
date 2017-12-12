import {Link} from 'react-router';
import LazyLoad from 'react-lazy-load';
import PropTypes from 'prop-types';
import React from 'react';

import {sortArray} from '../../../utils';
import {t, tct} from '../../../locale';
import ApiMixin from '../../../mixins/apiMixin';
import {update} from '../../../actionCreators/projects';
import TooltipMixin from '../../../mixins/tooltip';
import BarChart from '../../../components/barChart';
import ProjectLabel from '../../../components/projectLabel';
import SentryTypes from '../../../proptypes';

const ExpandedTeamList = React.createClass({
  propTypes: {
    access: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    teamList: PropTypes.arrayOf(SentryTypes.Team).isRequired,
    projectStats: PropTypes.object,
    urlPrefix: PropTypes.string,
    hasTeams: PropTypes.bool,
  },

  mixins: [
    ApiMixin,
    TooltipMixin(function() {
      return {
        selector: '.tip',
        title: function(instance) {
          return this.getAttribute('data-isbookmarked') === 'true'
            ? 'Remove from bookmarks'
            : 'Add to bookmarks';
        },
      };
    }),
  ],

  leaveTeam(team) {
    // TODO(dcramer): handle loading indicator
    this.api.leaveTeam({
      orgId: this.props.organization.slug,
      teamId: team.slug,
    });
  },

  urlPrefix() {
    let {organization, urlPrefix} = this.props;
    return urlPrefix || `/organizations/${organization.slug}/`;
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
    let {organization} = this.props;
    return (
      <tbody>
        <tr>
          <td>
            <p className="project-list-empty">
              {tct(
                'There are no projects in this team. Get started by [link:creating your first project].',
                {
                  link: (
                    <Link
                      to={`/organizations/${organization.slug}/projects/new/?team=${team.slug}`}
                    />
                  ),
                }
              )}
            </p>
          </td>
        </tr>
      </tbody>
    );
  },

  renderTeamNode(team, urlPrefix) {
    // TODO: make this cleaner
    let access = this.props.access;
    return (
      <div className="box" key={team.slug}>
        <div className="box-header">
          <div className="pull-right actions hidden-xs">
            <a className="leave-team" onClick={this.leaveTeam.bind(this, team)}>
              {t('Leave Team')}
            </a>
            {access.has('team:write') && (
              <Link
                className="team-settings"
                to={`${this.urlPrefix()}teams/${team.slug}/settings/`}
              >
                {t('Team Settings')}
              </Link>
            )}
          </div>
          <h3>{team.name}</h3>
        </div>
        <div className="box-content">
          <table className="table table-no-top-border m-b-0">
            {team.projects.length
              ? this.renderProjectList(team)
              : this.renderNoProjects(team)}
          </table>
        </div>
      </div>
    );
  },

  toggleBookmark(project) {
    update(this.api, {
      orgId: this.props.organization.slug,
      projectId: project.slug,
      data: {
        isBookmarked: !project.isBookmarked,
      },
    });
  },

  renderProject(project) {
    let org = this.props.organization;
    let chartData =
      project.stats &&
      project.stats.map(point => {
        return {x: point[0], y: point[1]};
      });

    return (
      <tr key={project.id} className={project.isBookmarked ? 'isBookmarked' : null}>
        <td>
          <h5>
            <a
              onClick={this.toggleBookmark.bind(this, project)}
              className="tip"
              data-isbookmarked={project.isBookmarked}
            >
              {project.isBookmarked ? (
                <span className="icon-star-solid bookmark" />
              ) : (
                <span className="icon-star-outline bookmark" />
              )}
            </a>
            <Link
              to={`/settings/organization/${org.slug}/project/${project.slug}/alerts/`}
            >
              <ProjectLabel project={project} organization={this.props.organization} />
            </Link>
          </h5>
        </td>
        <td className="align-right project-chart">
          {chartData && (
            <LazyLoad>
              <BarChart points={chartData} label="events" />
            </LazyLoad>
          )}
        </td>
      </tr>
    );
  },

  renderEmpty() {
    if (this.props.hasTeams) {
      return (
        <p>
          {this.props.access.has('project:write')
            ? tct(
                'You are not a member of any teams. [joinLink:Join an existing team] or [createLink:create a new one].',
                {
                  joinLink: <Link to={`${this.urlPrefix()}all-teams/`} />,
                  createLink: <Link to={this.urlPrefix() + 'teams/new/'} />,
                }
              )
            : tct('You are not a member of any teams. [joinLink:Join a team].', {
                joinLink: <Link to={`${this.urlPrefix()}all-teams/`} />,
              })}
        </p>
      );
    }
    return (
      <p>
        {tct(
          'You dont have any teams for this organization yet. Get started by [link:creating your first team].',
          {
            link: <Link to={this.urlPrefix() + 'teams/new/'} />,
          }
        )}
      </p>
    );
  },

  renderTeamNodes() {
    return this.props.teamList.map(team => {
      return this.renderTeamNode(team);
    });
  },

  render() {
    let hasTeams = this.props.teamList.length > 0;

    return <div>{hasTeams ? this.renderTeamNodes() : this.renderEmpty()}</div>;
  },
});

export default ExpandedTeamList;
