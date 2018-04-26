import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {withRouter} from 'react-router';
import {Flex} from 'grid-emotion';

import SentryTypes from '../../proptypes';
import Link from '../../components/link';

import {Client} from '../../api';

import {update} from '../../actionCreators/projects';
import overflowEllipsis from '../../styles/overflowEllipsis';

class ProjectCard extends React.Component {
  static propTypes = {
    project: SentryTypes.Project.isRequired,
    params: PropTypes.object,
  };

  toggleProjectBookmark = () => {
    const {project, params} = this.props;

    update(new Client(), {
      orgId: params.orgId,
      projectId: project.slug,
      data: {
        isBookmarked: !project.isBookmarked,
      },
    });
  };

  render() {
    const {project, params} = this.props;

    return (
      <StyledProjectCard>
        <Flex justify="space-between" p={2} align="center">
          <StyledLink to={`/${params.orgId}/${project.slug}/`}>
            <strong>{project.slug}</strong>
          </StyledLink>
          <Star
            active={project.isBookmarked}
            className="project-select-bookmark icon icon-star-solid"
            onClick={this.toggleProjectBookmark}
          />
        </Flex>
      </StyledProjectCard>
    );
  }
}

const StyledLink = styled(Link)`
  ${overflowEllipsis};
`;

const StyledProjectCard = styled.div`
  background-color: white;
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowLight};
`;

const Star = styled.a`
  color: ${p => (p.active ? p.theme.yellowOrange : '#afa3bb')};
  &:hover {
    color: ${p => p.theme.yellowOrange};
    opacity: 0.6;
  }
`;

export {ProjectCard};
export default withRouter(ProjectCard);
