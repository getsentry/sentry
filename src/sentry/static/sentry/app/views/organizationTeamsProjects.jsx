import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';
import LazyLoad from 'react-lazy-load';

import {Box, Flex} from '../components/grid';
import BarChart from '../components/barChart';
import Button from '../components/buttons/button';
import {Client} from '../api';
import {loadStats} from '../actionCreators/projects';
import {Panel, PanelBody, PanelHeader, PanelItem} from '../components/panels';
import ProjectLabel from '../components/projectLabel';
import SentryTypes from '../proptypes';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import {t, tct} from '../locale';
import withProjects from '../utils/withProjects';
import withTeams from '../utils/withTeams';

class OrganizationTeamsProjectsView extends React.Component {
  static propTypes = {
    params: PropTypes.object,
    projects: PropTypes.array,
    teams: PropTypes.array,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
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

  renderNoProjects(teamSlug) {
    let {orgId} = this.props.params;
    return (
      <tbody>
        <tr>
          <td>
            <p className="project-list-empty">
              {tct(
                'There are no projects in this team. Get started by [link:creating your first project].',
                {
                  link: (
                    <a href={`/organizations/${orgId}/projects/new/?team=' + teamSlug`} />
                  ),
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

    let access = new Set(this.context.organization.access);

    return (
      <PanelItem key={project.id} align="center">
        <Flex flex="1" justify="space-between">
          <Link to={`/${orgId}/${project.slug}/`}>
            <ProjectLabel project={project} />
          </Link>
          <div className="project-chart">
            {chartData && (
              <LazyLoad>
                <BarChart points={chartData} label="events" />
              </LazyLoad>
            )}
          </div>
        </Flex>
        {access.has('project:write') && (
          <Box ml={2}>
            <Button size="small" to={`/settings/${orgId}/${project.slug}/`}>
              {t('Manage Project')}
            </Button>
          </Box>
        )}
      </PanelItem>
    );
  };

  renderProjectList(projects) {
    return projects.map(this.renderProject);
  }

  renderTeamNode = (teamSlug, projects) => {
    let display = teamSlug === null ? t('Projects Without Teams') : `#${teamSlug}`;
    return (
      <Panel key={teamSlug}>
        <PanelHeader css={{textTransform: 'none'}}>{display}</PanelHeader>
        <PanelBody>
          {projects.length
            ? this.renderProjectList(projects)
            : this.renderNoProjects(teamSlug)}
        </PanelBody>
      </Panel>
    );
  };

  render() {
    let {projects, teams} = this.props;
    let projectsByTeam = {};
    let teamlessProjects = [];
    let usersTeams = new Set(teams.filter(team => team.isMember).map(team => team.slug));

    projects.forEach(project => {
      if (!project.teams.length && project.isMember) {
        teamlessProjects.push(project);
      } else {
        project.teams.forEach(team => {
          if (!usersTeams.has(team.slug)) {
            return;
          }
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
            {Object.keys(projectsByTeam)
              .sort()
              .map(teamSlug => {
                return this.renderTeamNode(
                  teamSlug,
                  projectsByTeam[teamSlug].sort((a, b) => {
                    if (a.slug > b.slug) return 1;
                    if (a.slug < b.slug) return -1;
                    return 0;
                  })
                );
              })}
            {!!teamlessProjects.length && this.renderTeamNode(null, teamlessProjects)}
          </div>
        </div>
      </div>
    );
  }
}

export default withTeams(withProjects(OrganizationTeamsProjectsView));
