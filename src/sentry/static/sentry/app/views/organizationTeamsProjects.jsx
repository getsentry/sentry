import PropTypes from 'prop-types';
import React from 'react';
import {Box, Flex} from 'grid-emotion';
import {Link} from 'react-router';
import LazyLoad from 'react-lazyload';

import BarChart from 'app/components/barChart';
import Button from 'app/components/buttons/button';
import {Client} from 'app/api';
import {loadStats} from 'app/actionCreators/projects';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import ProjectLabel from 'app/components/projectLabel';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {t, tct} from 'app/locale';
import withProjects from 'app/utils/withProjects';
import withTeams from 'app/utils/withTeams';
import getProjectsByTeams from 'app/utils/getProjectsByTeams';
import {sortProjects} from 'app/utils';

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
    const {projects, teams} = this.props;
    const {projectsByTeam, teamlessProjects} = getProjectsByTeams(teams, projects);

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
                  sortProjects(projectsByTeam[teamSlug])
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
