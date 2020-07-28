import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import {Team, Project, Scope} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import PageHeading from 'app/components/pageHeading';

import TeamMembers from './teamMembers';
import ProjectCard from './projectCard';

type Props = {
  team: Team;
  orgId: string;
  showBorder: boolean;
  access: Set<Scope>;
  title: React.ReactNode;
  projects: Project[];
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

TeamSection.propTypes = {
  team: SentryTypes.Team,
  orgId: PropTypes.string,
  showBorder: PropTypes.bool,
  access: PropTypes.object,
  title: PropTypes.node,
  projects: PropTypes.array,
};

const ProjectCards = styled('div')`
  display: flex;
  flex-wrap: wrap;
  padding: 0 ${space(3)} ${space(3)};
`;

const TeamSectionWrapper = styled('div')<{showBorder: boolean}>`
  border-bottom: ${p => (p.showBorder ? '1px solid ' + p.theme.borderLight : 0)};

  &:last-child {
    ${ProjectCards} {
      padding-bottom: 0;
    }
  }
`;

const TeamTitleBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(3)} ${space(4)} 10px;
`;

const TeamName = styled(PageHeading)`
  font-size: 20px;
  line-height: 24px; /* We need this so that header doesn't flicker when lazy loading because avatarList height > this */
`;

export default TeamSection;
