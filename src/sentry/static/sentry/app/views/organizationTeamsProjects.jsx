import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';
import LazyLoad from 'react-lazy-load';

import BarChart from '../components/barChart';
import Button from '../components/buttons/button';
import {Client} from '../api';
import {loadStats} from '../actionCreators/projects';
import ProjectLabel from '../components/projectLabel';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import {t, tct} from '../locale';
import withProjects from '../utils/withProjects';

class OrganizationTeamsProjectsView extends React.Component {
  static propTypes = {
    params: PropTypes.object,
    projects: PropTypes.array,
  };

  componentWillMount() {
    this.api = new Client();
  }

  componentDidMount() {
    this.fetchStats();
  }

  componentWillUnmount() {
    this.api.clear();
  }

  fetchStats() {
    loadStats(this.api, {
      orgId: this.props.params.orgId,
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'generated',
        group: 'project',
      },
    });
  }

  urlPrefix() {
    let {orgId} = this.props.params;
    return `/organizations/${orgId}`;
  }

  renderNoProjects(teamSlug) {
    return (
      <tbody>
        <tr>
          <td>
            <p className="project-list-empty">
              {tct(
                'There are no projects in this team. Get started by [link:creating your first project].',
                {
                  link: <a href={this.urlPrefix() + '/projects/new/?team=' + teamSlug} />,
                }
              )}
            </p>
          </td>
        </tr>
      </tbody>
    );
  }

  renderProject = project => {
    let {orgId} = this.props.params;
    let chartData =
      project.stats &&
      project.stats.map(point => {
        return {x: point[0], y: point[1]};
      });

    // TODO(jess): prob should make sure they actually can manage projects

    return (
      <tr key={project.id} className={project.isBookmarked ? 'isBookmarked' : null}>
        <td>
          <h5>
            <Link to={`/${orgId}/${project.slug}/`}>
              <ProjectLabel project={project} />
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
        <td className="align-right">
          <Button
            priority="default"
            size="small"
            to={`/settings/organization/${orgId}/project/${project.slug}/settings/`}
          >
            {t('Manage Project')}
          </Button>
        </td>
      </tr>
    );
  };

  renderProjectList(projects) {
    return <tbody>{projects.map(this.renderProject)}</tbody>;
  }

  renderTeamNode = (teamSlug, projects) => {
    let display = teamSlug === null ? t('Projects Without Teams') : `#${teamSlug}`;
    return (
      <div className="box" key={teamSlug}>
        <div className="box-header">
          <h3>{display}</h3>
        </div>
        <div className="box-content">
          <table className="table table-no-top-border m-b-0">
            {projects.length
              ? this.renderProjectList(projects)
              : this.renderNoProjects(teamSlug)}
          </table>
        </div>
      </div>
    );
  };

  render() {
    let {projects} = this.props;
    let projectsByTeam = {};
    let teamlessProjects = [];

    projects.forEach(project => {
      if (!project.teams.length) {
        teamlessProjects.push(project);
      } else {
        project.teams.forEach(team => {
          if (!projectsByTeam[team.slug]) {
            projectsByTeam[team.slug] = [];
          }
          projectsByTeam[team.slug].push(project);
        });
      }
    });

    return (
      <div className="row">
        <SettingsPageHeader title={t('Projects by Team')} />
        <div className="col-md-9">
          <div className="team-list">
            {Object.keys(projectsByTeam).map(teamSlug => {
              return this.renderTeamNode(teamSlug, projectsByTeam[teamSlug]);
            })}
            {!!teamlessProjects.length && this.renderTeamNode(null, teamlessProjects)}
          </div>
        </div>
      </div>
    );
  }
}

export default withProjects(OrganizationTeamsProjectsView);
