import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import {Flex, Box} from 'grid-emotion';
import styled from 'react-emotion';

import OrganizationState from '../../mixins/organizationState';
import OldDashboard from './oldDashboard';
import ProjectNav from './projectNav';
import TeamMembers from './teamMembers';
import ProjectCard from './projectCard';
import getProjectsByTeams from '../../utils/getProjectsByTeams';
import withTeams from '../../utils/withTeams';
import withProjects from '../../utils/withProjects';

class Dashboard extends React.Component {
  static propTypes = {
    teams: PropTypes.array,
    projects: PropTypes.array,
  };

  componentWillMount() {
    $(document.body).addClass('org-dashboard');
  }
  componentWillUnmount() {
    $(document.body).removeClass('org-dashboard');
  }

  render() {
    const {projects, teams} = this.props;
    const {projectsByTeam} = getProjectsByTeams(teams, projects);
    const projectKeys = Object.keys(projectsByTeam);

    return (
      <div>
        <ProjectNav />
        <div>
          {projectKeys.map((slug, index) => {
            return (
              <TeamSection key={slug} renderBorder={index !== projectKeys.length - 1}>
                <TeamTitleBar justify="space-between" align="center">
                  <TeamName>{`#${slug}`}</TeamName>
                  <TeamMembers teamId={slug} orgId={this.props.params.orgId} />
                </TeamTitleBar>
                <ProjectCards>
                  {projectsByTeam[slug].map(project => {
                    return (
                      <ProjectCardWrapper
                        key={project.id}
                        width={['100%', '50%', '33%', '25%']}
                      >
                        <ProjectCard project={project} />
                      </ProjectCardWrapper>
                    );
                  })}
                </ProjectCards>
              </TeamSection>
            );
          })}
        </div>
      </div>
    );
  }
}

const TeamSection = styled.div`
  border-bottom: ${p => (p.renderBorder ? '1px solid ' + p.theme.borderLight : 0)};
`;

const TeamTitleBar = styled(Flex)`
  padding: 24px 24px 0;
  margin-bottom: 16px;
`;

const TeamName = styled.h4`
  margin: 0;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const ProjectCards = styled(Flex)`
  flex-wrap: wrap;
  padding: 0 16px 24px;
`;

const ProjectCardWrapper = styled(Box)`
  padding: 8px;
`;

const OrganizationDashboard = createReactClass({
  displayName: 'OrganizationDashboard',
  mixins: [OrganizationState],

  render() {
    const hasNewDashboardFeature = this.getFeatures().has('dashboard');

    if (hasNewDashboardFeature) {
      return <Dashboard {...this.props} />;
    } else {
      return <OldDashboard {...this.props} />;
    }
  },
});

export default withTeams(withProjects(OrganizationDashboard));
