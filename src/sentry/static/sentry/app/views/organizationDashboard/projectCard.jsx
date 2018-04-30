import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {withRouter} from 'react-router';
import {Flex} from 'grid-emotion';

import SentryTypes from 'app/proptypes';
import Link from 'app/components/link';

import {Client} from 'app/api';

import {update} from 'app/actionCreators/projects';
import overflowEllipsis from 'app/styles/overflowEllipsis';

class PlatformList extends React.Component {
  static propTypes = {
    platforms: PropTypes.arrayOf(PropTypes.string),
  };

  getIcon(platform) {
    return (
      <StyledPlatformIconWrapper key={platform} className={platform}>
        <StyledPlatformIcon className={`platformicon platformicon-${platform}`} />
      </StyledPlatformIconWrapper>
    );
  }

  getIcons(platforms) {
    return (
      <Flex direction="row-reverse" m={18}>
        {platforms.map(this.getIcon)}
      </Flex>
    );
  }
  render() {
    const {platforms} = this.props;

    if (!platforms.length)
      return (
        <NoPlatforms align="center" p={2}>
          No platforms yet
        </NoPlatforms>
      );

    return (
      <Flex align="center">
        <div className="org-dashboard-platform-list">{this.getIcons(platforms)}</div>
        <PlatformText>
          {platforms
            .slice()
            .reverse()
            .join(', ')}
        </PlatformText>
      </Flex>
    );
  }
}

const StyledPlatformIconWrapper = styled.span`
  display: block;
  margin-right: -14px;
  margin-left: -2px;
`;

const StyledPlatformIcon = styled.span`
  display: block;
  color: white;
  height: 34px;
  width: 34px;
  font-size: 22px;
  border-radius: 4px;
  border: 2px solid white;
  padding: 4px;
`;

const PlatformText = styled.div`
  color: ${p => p.theme.gray2};
  font-size: 13px;
`;

const NoPlatforms = styled(Flex)`
  height: 70px;
`;

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
        <PlatformList platforms={project.platforms} />
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
