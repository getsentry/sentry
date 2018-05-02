import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {withRouter} from 'react-router';
import {Flex} from 'grid-emotion';

import SentryTypes from 'app/proptypes';
import {Client} from 'app/api';
import Link from 'app/components/link';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {update} from 'app/actionCreators/projects';
import overflowEllipsis from 'app/styles/overflowEllipsis';

import PlatformList from './platformList';
import Chart from './chart';
import NoEvents from './noEvents';

class ProjectCard extends React.Component {
  static propTypes = {
    project: SentryTypes.Project.isRequired,
    stats: PropTypes.array,
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
    const {project, stats, params} = this.props;

    const bookmarkText = project.isBookmarked
      ? t('Remove from bookmarks')
      : t('Add to bookmarks');

    return (
      <StyledProjectCard>
        <Flex justify="space-between" p={2} align="center">
          <StyledLink to={`/${params.orgId}/${project.slug}/`}>
            <strong>{project.slug}</strong>
          </StyledLink>
          <Tooltip title={bookmarkText}>
            <Star
              active={project.isBookmarked}
              className="project-select-bookmark icon icon-star-solid"
              onClick={this.toggleProjectBookmark}
            />
          </Tooltip>
        </Flex>
        <ChartContainer>
          <Chart stats={stats} noEvents={!project.firstEvent} />
          {!project.firstEvent && <NoEvents />}
        </ChartContainer>
        <PlatformList project={project} orgId={params.orgId} />
      </StyledProjectCard>
    );
  }
}

const ChartContainer = styled.div`
  position: relative;
`;

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
