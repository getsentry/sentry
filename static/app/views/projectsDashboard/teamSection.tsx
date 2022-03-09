import * as React from 'react';
import styled from '@emotion/styled';

import PageHeading from 'sentry/components/pageHeading';
import space from 'sentry/styles/space';
import {Project, Scope, Team} from 'sentry/types';

import ProjectCard from './projectCard';
import TeamMembers from './teamMembers';

type Props = {
  access: Set<Scope>;
  orgId: string;
  projects: Project[];
  showBorder: boolean;
  team: Team;
  title: React.ReactNode;
};

const TeamSection = ({team, projects, title, showBorder, orgId, access}: Props) => {
  const hasTeamAccess = access.has('team:read');
  const hasProjectAccess = access.has('project:read');

  return (
    <TeamSectionWrapper data-test-id="team" showBorder={showBorder}>
      <TeamTitleBar>
        <TeamName>{title}</TeamName>
        {hasTeamAccess && team && <TeamMembers teamId={team.slug} orgId={orgId} />}
      </TeamTitleBar>
      <ProjectCards>
        {projects.map(project => (
          <ProjectCard
            data-test-id={project.slug}
            key={project.slug}
            project={project}
            hasProjectAccess={hasProjectAccess}
          />
        ))}
      </ProjectCards>
    </TeamSectionWrapper>
  );
};

const ProjectCards = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  gap: ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
  }
`;

const TeamSectionWrapper = styled('div')<{showBorder: boolean}>`
  border-bottom: ${p => (p.showBorder ? '1px solid ' + p.theme.border : 0)};
  padding: 0 ${space(4)} ${space(4)};
`;

const TeamTitleBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(3)} 0 ${space(2)};
`;

const TeamName = styled(PageHeading)`
  font-size: 20px;
  line-height: 24px; /* We need this so that header doesn't flicker when lazy loading because avatarList height > this */
`;

export default TeamSection;
