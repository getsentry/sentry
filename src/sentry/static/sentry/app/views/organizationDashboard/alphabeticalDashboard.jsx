import {Flex, Box} from 'grid-emotion';
import LazyLoad from 'react-lazyload';
import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import SentryTypes from 'app/proptypes';
import space from 'app/styles/space';
import {sortProjects} from 'app/utils';

import ProjectCard from './projectCard';
import EmptyState from './emptyState';

class AlphabeticalDashboard extends React.Component {
  static propTypes = {
    teams: PropTypes.array,
    projects: PropTypes.array,
    organization: SentryTypes.Organization,
  };

  render() {
    const {teams, projects, organization} = this.props;
    const favorites = sortProjects(projects.filter(project => project.isBookmarked));
    const otherProjects = sortProjects(projects.filter(project => !project.isBookmarked));

    return (
      <React.Fragment>
        <div style={{overflow: 'auto', position: 'relative'}}>
          <ProjectCards>
            {[...favorites, ...otherProjects].map(project => (
              <LazyLoad
                key={project.slug}
                once
                height={180}
                debounce={50}
                placeholder={
                  <TeamSectionPlaceholder width={['100%', '50%', '33%', '25%']} />
                }
              >
                <ProjectCard
                  data-test-id={project.slug}
                  key={project.slug}
                  project={project}
                />
              </LazyLoad>
            ))}
          </ProjectCards>
        </div>
        {projects.length === 0 && (
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

// This placeholder height will mean that we query for the first `window.height / 180` components
const TeamSectionPlaceholder = styled(Box)`
  background: ${p => p.theme.offWhite};
  padding: 10px;
  height: 180px;
`;

export default AlphabeticalDashboard;
