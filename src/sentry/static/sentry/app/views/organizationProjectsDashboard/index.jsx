import {Link} from 'react-router';
import LazyLoad from 'react-lazyload';
import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import IdBadge from 'app/components/idBadge';
import NoProjectMessage from 'app/components/noProjectMessage';
import OrganizationState from 'app/mixins/organizationState';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';
import getProjectsByTeams from 'app/utils/getProjectsByTeams';
import {sortProjects} from 'app/utils';
import withTeams from 'app/utils/withTeams';
import withProjects from 'app/utils/withProjects';
import {t} from 'app/locale';

import ProjectNav from './projectNav';
import TeamSection from './teamSection';
import Resources from './resources';

class Dashboard extends React.Component {
  static propTypes = {
    teams: PropTypes.array,
    projects: PropTypes.array,
    organization: SentryTypes.Organization,
  };

  componentDidMount() {
    document.body.classList.add('org-dashboard');
  }
  componentWillUnmount() {
    document.body.classList.remove('org-dashboard');
    ProjectsStatsStore.reset();
  }

  render() {
    const {teams, projects, params, organization} = this.props;
    const sortedProjects = sortProjects(projects);
    const {projectsByTeam} = getProjectsByTeams(teams, sortedProjects);
    const teamSlugs = Object.keys(projectsByTeam).sort();
    const favorites = projects.filter(project => project.isBookmarked);
    const access = new Set(organization.access);
    const teamsMap = new Map(teams.map(teamObj => [teamObj.slug, teamObj]));

    const hasTeamAdminAccess = access.has('team:admin');

    if (projects.length === 1 && !projects[0].firstEvent) {
      return <Resources org={organization} project={projects[0]} />;
    }

    return (
      <React.Fragment>
        {favorites.length > 0 && (
          <TeamSection
            data-test-id="favorites"
            orgId={params.orgId}
            showBorder
            team={null}
            title={t('Bookmarked projects')}
            projects={favorites}
            access={access}
          />
        )}

        {teamSlugs.map((slug, index) => {
          const showBorder = index !== teamSlugs.length - 1;
          const team = teamsMap.get(slug);
          return (
            <LazyLoad key={slug} once debounce={50} height={300} offset={300}>
              <TeamSection
                orgId={params.orgId}
                team={team}
                showBorder={showBorder}
                title={
                  hasTeamAdminAccess ? (
                    <TeamLink to={`/settings/${organization.slug}/teams/${team.slug}/`}>
                      <IdBadge team={team} />
                    </TeamLink>
                  ) : (
                    <IdBadge team={team} />
                  )
                }
                projects={projectsByTeam[slug]}
                access={access}
              />
            </LazyLoad>
          );
        })}
        {teamSlugs.length === 0 &&
          favorites.length === 0 && <NoProjectMessage organization={organization} />}
      </React.Fragment>
    );
  }
}

const OrganizationDashboard = createReactClass({
  displayName: 'OrganizationDashboard',
  mixins: [OrganizationState],

  render() {
    return (
      <Flex flex="1" direction="column">
        <ProjectNav />
        <Dashboard organization={this.context.organization} {...this.props} />
      </Flex>
    );
  },
});

const TeamLink = styled(Link)`
  display: flex;
  align-items: center;
`;

export {Dashboard};
export default withTeams(withProjects(OrganizationDashboard));
