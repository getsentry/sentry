import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Project, Organization} from 'app/types';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ProjectCard from 'app/views/projectsDashboard/projectCard';
import {IconFlag} from 'app/icons';

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

    if (projects.length === 0) {
      return (
        <EmptyMessage icon={<IconFlag size="xl" />} size="large">
          {t('This team has no projects')}
        </EmptyMessage>
      );
    }

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
`;
