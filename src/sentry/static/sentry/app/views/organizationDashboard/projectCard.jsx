import React from 'react';
import styled from 'react-emotion';
import {withRouter} from 'react-router';

import SentryTypes from '../../proptypes';
import Link from '../../components/link';

class ProjectCard extends React.Component {
  static propTypes = {
    project: SentryTypes.Project.isRequired,
  };

  render() {
    const {project, params} = this.props;

    return (
      <StyledProjectCard>
        <ProjectCardHeader>
          <Link to={`/${params.orgId}/${project.slug}/`}>{project.slug}</Link>
        </ProjectCardHeader>
      </StyledProjectCard>
    );
  }
}

const StyledProjectCard = styled.div`
  background-color: white;
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowLight};
`;

const ProjectCardHeader = styled.div``;

export default withRouter(ProjectCard);
