import React from 'react';
import PropTypes from 'prop-types';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

import SentryTypes from 'app/proptypes';

import TeamMembers from './teamMembers';
import ProjectCard from './projectCard';

class TeamSection extends React.Component {
  static propTypes = {
    team: SentryTypes.Team,
    orgId: PropTypes.string,
    showBorder: PropTypes.bool,
    hasTeamAccess: PropTypes.bool,
    title: PropTypes.node,
    projects: PropTypes.array,
  };

  render() {
    const {team, projects, title, showBorder, orgId, hasTeamAccess} = this.props;

    return (
      <TeamSectionWrapper data-test-id="team" showBorder={showBorder}>
        <TeamTitleBar justify="space-between" align="center">
          <TeamName>{title}</TeamName>
          {hasTeamAccess && team && <TeamMembers teamId={team.slug} orgId={orgId} />}
        </TeamTitleBar>
        <ProjectCards>
          {projects.map(project => (
            <ProjectCard
              data-test-id={project.slug}
              key={project.slug}
              project={project}
            />
          ))}
        </ProjectCards>
      </TeamSectionWrapper>
    );
  }
}

const TeamSectionWrapper = styled.div`
  border-bottom: ${p => (p.showBorder ? '1px solid ' + p.theme.borderLight : 0)};
  min-height: 180px;
`;

const TeamTitleBar = styled(Flex)`
  padding: 24px 24px 0;
  margin-bottom: 16px;
`;

const TeamName = styled.h4`
  margin: 0;
  font-size: 20px;
  line-height: 24px;
`;

const ProjectCards = styled(Flex)`
  flex-wrap: wrap;
  padding: 0 16px 24px;
`;

export default TeamSection;
