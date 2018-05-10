import LazyLoad from 'react-lazyload';
import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

import SentryTypes from 'app/proptypes';
import IdBadge from 'app/components/idBadge';
import OrganizationState from 'app/mixins/organizationState';
import getProjectsByTeams from 'app/utils/getProjectsByTeams';
import {sortProjects} from 'app/utils';
import withTeams from 'app/utils/withTeams';
import withProjects from 'app/utils/withProjects';
import {t} from 'app/locale';

import OldDashboard from './oldDashboard';
import ProjectNav from './projectNav';
import TeamSection from './teamSection';
import EmptyState from './emptyState';

class Dashboard extends React.Component {
  static propTypes = {
    teams: PropTypes.array,
    projects: PropTypes.array,
    organization: SentryTypes.Organization,
  };

  componentWillMount() {
    $(document.body).addClass('org-dashboard');
  }
  componentWillUnmount() {
    $(document.body).removeClass('org-dashboard');
  }

  render() {
    const {teams, projects, params, organization} = this.props;
    const sortedProjects = sortProjects(projects);
    const {projectsByTeam} = getProjectsByTeams(teams, sortedProjects);
    const teamSlugs = Object.keys(projectsByTeam).sort();
    const favorites = projects.filter(project => project.isBookmarked);
    const hasTeamAccess = new Set(organization.access).has('team:read');
    const teamsMap = new Map(teams.map(teamObj => [teamObj.slug, teamObj]));

    return (
      <React.Fragment>
        {favorites.length > 0 && (
          <TeamSection
            type="favorites"
            orgId={params.orgId}
            showBorder
            team={null}
            title={t('Favorites')}
            projects={favorites}
          />
        )}

        {teamSlugs.map((slug, index) => {
          const showBorder = index !== teamSlugs.length - 1;
          const team = teamsMap.get(slug);
          return (
            <LazyLoad
              key={slug}
              once
              debounce={50}
              placeholder={<TeamSectionPlaceholder />}
            >
              <TeamSection
                orgId={params.orgId}
                team={team}
                hasTeamAccess={hasTeamAccess}
                showBorder={showBorder}
                title={<IdBadge team={team} />}
                projects={projectsByTeam[slug]}
              />
            </LazyLoad>
          );
        })}
        {!teamSlugs.length && (
          <EmptyState projects={projects} teams={teams} organization={organization} />
        )}
      </React.Fragment>
    );
  }
}

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

// This placeholder height will mean that we query for the first `window.height / 180` components
const TeamSectionPlaceholder = styled('div')`
  height: 180px;
`;
export {Dashboard};
export default withTeams(withProjects(OrganizationDashboard));
