import PropTypes from 'prop-types';
import React from 'react';
import {Box, Flex} from 'grid-emotion';
import {Link} from 'react-router';
import LazyLoad from 'react-lazy-load';

import BarChart from '../components/barChart';
import Button from '../components/buttons/button';
import {Client} from '../api';
import {loadStats} from '../actionCreators/projects';
import Panel from './settings/components/panel';
import PanelBody from './settings/components/panelBody';
import PanelHeader from './settings/components/panelHeader';
import PanelItem from './settings/components/panelItem';
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
        <Box ml={2}>
          <Button
            priority="default"
            size="small"
            to={`/settings/organization/${orgId}/project/${project.slug}/settings/`}
          >
            {t('Manage Project')}
          </Button>
        </Box>
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
