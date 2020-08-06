import React from 'react';
import styled from '@emotion/styled';

import {Project, Organization} from 'app/types';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';
import ProjectCard from 'app/views/projectsDashboard/projectCard';

type Props = {
  projects: Array<Project>;
  organization: Organization;
  hasAccess: boolean;
};

class Projects extends React.Component<Props> {
  componentWillUnmount() {
    // @ts-ignore Property 'reset' does not exist on type 'Store'
    ProjectsStatsStore.reset();
  }

  render() {
    const {projects, organization, hasAccess} = this.props;

    return (
      <Wrapper>
        {projects.map(project => (
          <ProjectCard
            key={project.slug}
            project={project}
            organization={organization}
            hasProjectAccess={hasAccess}
          />
        ))}
      </Wrapper>
    );
  }
}

export default Projects;

const Wrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  margin: -10px;
`;
