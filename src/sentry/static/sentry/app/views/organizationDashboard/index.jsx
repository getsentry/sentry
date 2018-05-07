import {flatten} from 'lodash';
import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import {Flex, Box} from 'grid-emotion';
import styled from 'react-emotion';

import AsyncComponent from 'app/components/asyncComponent';
import OrganizationState from 'app/mixins/organizationState';
import getProjectsByTeams from 'app/utils/getProjectsByTeams';
import {sortProjects} from 'app/utils';
import withTeams from 'app/utils/withTeams';
import withProjects from 'app/utils/withProjects';
import {t} from 'app/locale';

import OldDashboard from './oldDashboard';
import ProjectNav from './projectNav';
import TeamMembers from './teamMembers';
import ProjectCard from './projectCard';
import EmptyState from './emptyState';

class Dashboard extends AsyncComponent {
  static propTypes = {
    teams: PropTypes.array,
    projects: PropTypes.array,
  };

  componentWillMount() {
    $(document.body).addClass('org-dashboard');
    super.componentWillMount();
  }
  componentWillUnmount() {
    $(document.body).removeClass('org-dashboard');
    super.componentWillUnmount();
  }

  getEndpoints() {
    const {projects, teams, params} = this.props;
    const {orgId} = params;

    // TODO(billy): Optimize this so we're not running the same sorts multiple times during a render
    const sortedProjects = sortProjects(projects);
    const {projectsByTeam} = getProjectsByTeams(teams, sortedProjects);

    // Fetch list of projectIds to get stats for
    const projectIds =
      (projectsByTeam &&
        flatten(
          Object.keys(projectsByTeam).map(teamSlug =>
            projectsByTeam[teamSlug].map(({id}) => id)
          )
        )) ||
      [];

    const idQueries = projectIds.map(id => `id:${id}`).join(' ');
    const idQueryString = (idQueries && `&query=${idQueries}`) || '';

    return [
      [
        'projectsWithStats',
        `/organizations/${orgId}/projects/?statsPeriod=24h${idQueryString}`,
      ],
    ];
  }

  renderProjectCard(project) {
    const {projectsWithStats} = this.state;

    const projectDetails = projectsWithStats.find(p => project.id === p.id) || {};
    const stats = projectDetails.stats || null;

    return (
      <ProjectCardWrapper
        data-test-id={project.slug}
        key={project.id}
        width={['100%', '50%', '33%', '25%']}
      >
        <ProjectCard project={project} stats={stats} />
      </ProjectCardWrapper>
    );
  }

  renderBody() {
    const {teams, projects, params} = this.props;
    const sortedProjects = sortProjects(projects);
    const {projectsByTeam} = getProjectsByTeams(teams, sortedProjects);
    const projectKeys = Object.keys(projectsByTeam);

    const favorites = projects.filter(project => project.isBookmarked);

    return (
      <React.Fragment>
        {favorites.length > 0 && (
          <div data-test-id="favorites">
            <TeamSection showBorder>
              <TeamTitleBar>
                <TeamName>{t('Favorites')}</TeamName>
              </TeamTitleBar>
              <ProjectCards>
                {favorites.map(project => this.renderProjectCard(project))}
              </ProjectCards>
            </TeamSection>
          </div>
        )}

        {projectKeys.map((slug, index) => {
          const showBorder = index !== projectKeys.length - 1;
          return (
            <TeamSection data-test-id="team" key={slug} showBorder={showBorder}>
              <TeamTitleBar justify="space-between" align="center">
                <TeamName>{`#${slug}`}</TeamName>
                <TeamMembers teamId={slug} orgId={params.orgId} />
              </TeamTitleBar>
              <ProjectCards>
                {projectsByTeam[slug].map(project => this.renderProjectCard(project))}
              </ProjectCards>
            </TeamSection>
          );
        })}
        {!projectKeys.length && <EmptyState orgId={params.orgId} />}
      </React.Fragment>
    );
  }
}

const TeamSection = styled.div`
  border-bottom: ${p => (p.showBorder ? '1px solid ' + p.theme.borderLight : 0)};
`;

const TeamTitleBar = styled(Flex)`
  padding: 24px 24px 0;
  margin-bottom: 16px;
`;

const TeamName = styled.h4`
  margin: 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const ProjectCards = styled(Flex)`
  flex-wrap: wrap;
  padding: 0 16px 24px;
`;

const ProjectCardWrapper = styled(Box)`
  padding: 8px;
`;

const OrganizationDashboard = createReactClass({
  displayName: 'OrganizationDashboard',
  mixins: [OrganizationState],

  render() {
    const hasNewDashboardFeature = this.getFeatures().has('dashboard');

    if (hasNewDashboardFeature) {
      return (
        <Flex flex="1" direction="column">
          <ProjectNav />
          <Dashboard {...this.props} />
        </Flex>
      );
    } else {
      return <OldDashboard {...this.props} />;
    }
  },
});

export {Dashboard};
export default withTeams(withProjects(OrganizationDashboard));
