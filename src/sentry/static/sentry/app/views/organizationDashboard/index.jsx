import {flatten} from 'lodash';
import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import {Flex, Box} from 'grid-emotion';
import styled from 'react-emotion';

import SentryTypes from 'app/proptypes';
import AsyncComponent from 'app/components/asyncComponent';
import OrganizationState from 'app/mixins/organizationState';
import getProjectsByTeams from 'app/utils/getProjectsByTeams';
import {sortProjects} from 'app/utils';
import space from 'app/styles/space';
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
    organization: SentryTypes.Organization,
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

  renderProjectCard = project => {
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
  };

  renderBody() {
    const {teams, projects, params, organization} = this.props;
    const sortedProjects = sortProjects(projects);
    const {projectsByTeam} = getProjectsByTeams(teams, sortedProjects);
    const teamSlugs = Object.keys(projectsByTeam).sort();

    const favorites = projects.filter(project => project.isBookmarked);

    const hasTeamAccess = new Set(organization.access).has('team:read');

    return (
      <React.Fragment>
        {favorites.length > 0 && (
          <div data-test-id="favorites">
            <TeamSection showBorder>
              <TeamTitleBar>
                <TeamName>{t('Favorites')}</TeamName>
              </TeamTitleBar>
              <ProjectCards>{favorites.map(this.renderProjectCard)}</ProjectCards>
            </TeamSection>
          </div>
        )}

        {teamSlugs.map((slug, index) => {
          const showBorder = index !== teamSlugs.length - 1;
          return (
            <TeamSection data-test-id="team" key={slug} showBorder={showBorder}>
              <TeamTitleBar justify="space-between" align="center">
                <TeamName>{`#${slug}`}</TeamName>
                {hasTeamAccess && <TeamMembers teamId={slug} orgId={params.orgId} />}
              </TeamTitleBar>
              <ProjectCards>
                {projectsByTeam[slug].map(this.renderProjectCard)}
              </ProjectCards>
            </TeamSection>
          );
        })}
        {!teamSlugs.length && (
          <EmptyState projects={projects} teams={teams} organization={organization} />
        )}
      </React.Fragment>
    );
  }
}

const ProjectCards = styled(Flex)`
  flex-wrap: wrap;
  padding: 0 ${space(3)} ${space(3)};
`;

const TeamSection = styled.div`
  border-bottom: ${p => (p.showBorder ? '1px solid ' + p.theme.borderLight : 0)};

  /* stylelint-disable no-duplicate-selectors */
  &:last-child {
    ${ProjectCards} {
      padding-bottom: 0;
    }
  }
  /* stylelint-enable */
`;

const TeamTitleBar = styled(Flex)`
  padding: ${space(3)} ${space(4)} 10px;
`;

const TeamName = styled.h4`
  margin: 0;
  font-size: 20px;
`;

const ProjectCardWrapper = styled(Box)`
  padding: 10px;
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
          <Dashboard organization={this.context.organization} {...this.props} />
        </Flex>
      );
    } else {
      return <OldDashboard {...this.props} />;
    }
  },
});

export {Dashboard};
export default withTeams(withProjects(OrganizationDashboard));
