import {Link} from 'react-router';
import LazyLoad from 'react-lazyload';
import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import SentryTypes from 'app/proptypes';
import IdBadge from 'app/components/idBadge';
import getProjectsByTeams from 'app/utils/getProjectsByTeams';
import {sortProjects} from 'app/utils';
import {t} from 'app/locale';

import TeamSection from './teamSection';
import EmptyState from './emptyState';

class TeamDashboard extends React.Component {
  static propTypes = {
    teams: PropTypes.array,
    projects: PropTypes.array,
    organization: SentryTypes.Organization,
  };

  render() {
    const {teams, projects, params, organization} = this.props;
    const sortedProjects = sortProjects(projects);
    const {projectsByTeam} = getProjectsByTeams(teams, sortedProjects);
    const teamSlugs = Object.keys(projectsByTeam).sort();
    const favorites = projects.filter(project => project.isBookmarked);
    const access = new Set(organization.access);
    const hasTeamAccess = access.has('team:read');
    const teamsMap = new Map(teams.map(teamObj => [teamObj.slug, teamObj]));

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
                title={
                  <TeamLink to={`/settings/${organization.slug}/teams/${team.slug}/`}>
                    <IdBadge team={team} />
                  </TeamLink>
                }
                projects={projectsByTeam[slug]}
              />
            </LazyLoad>
          );
        })}
        {teamSlugs.length === 0 &&
          favorites.length === 0 && (
            <EmptyState projects={projects} teams={teams} organization={organization} />
          )}
      </React.Fragment>
    );
  }
}

// This placeholder height will mean that we query for the first `window.height / 180` components
const TeamSectionPlaceholder = styled('div')`
  height: 180px;
`;

const TeamLink = styled(Link)`
  display: flex;
  align-items: center;
`;

export default TeamDashboard;
