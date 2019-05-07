import {Flex} from 'grid-emotion';
import {Link, browserHistory} from 'react-router';
import LazyLoad from 'react-lazyload';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {sortProjects} from 'app/utils';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import Feature from 'app/components/acl/feature';
import IdBadge from 'app/components/idBadge';
import NoProjectMessage from 'app/components/noProjectMessage';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';
import SentryTypes from 'app/sentryTypes';
import getProjectsByTeams from 'app/utils/getProjectsByTeams';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';
import withTeams from 'app/utils/withTeams';

import ProjectNav from './projectNav';
import Resources from './resources';
import TeamSection from './teamSection';

class Dashboard extends React.Component {
  static propTypes = {
    routes: PropTypes.array,
    teams: PropTypes.array,
    projects: PropTypes.array,
    hasSentry10: PropTypes.bool,
    organization: SentryTypes.Organization,
  };

  componentDidMount() {
    const {organization, routes, hasSentry10} = this.props;
    const isOldRoute = getRouteStringFromRoutes(routes) === '/:orgId/';

    if (hasSentry10 && isOldRoute) {
      browserHistory.replace(`/organizations/${organization.slug}/`);
    }
  }
  componentWillUnmount() {
    ProjectsStatsStore.reset();
  }

  render() {
    const {teams, projects, params, hasSentry10, organization} = this.props;
    const sortedProjects = sortProjects(projects);

    const {isSuperuser} = ConfigStore.get('user');

    const {projectsByTeam} = getProjectsByTeams(teams, sortedProjects, isSuperuser);
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
        {!hasSentry10 && favorites.length > 0 && (
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
        {teamSlugs.length === 0 && favorites.length === 0 && (
          <NoProjectMessage organization={organization}>{null}</NoProjectMessage>
        )}
      </React.Fragment>
    );
  }
}

const OrganizationDashboard = createReactClass({
  render() {
    return (
      <Feature features={['sentry10']}>
        {({hasFeature}) => (
          <Flex flex="1" direction="column">
            {!hasFeature && <ProjectNav />}
            <Dashboard hasSentry10={hasFeature} {...this.props} />
          </Flex>
        )}
      </Feature>
    );
  },
});

const TeamLink = styled(Link)`
  display: flex;
  align-items: center;
`;

export {Dashboard};
export default withTeams(withProjects(withOrganization(OrganizationDashboard)));
