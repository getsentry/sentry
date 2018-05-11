import createReactClass from 'create-react-class';
import React from 'react';
import Reflux from 'reflux';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {withRouter} from 'react-router';
import {Flex, Box} from 'grid-emotion';

import {addErrorMessage} from 'app/actionCreators/indicator';
import SentryTypes from 'app/proptypes';
import {Client} from 'app/api';
import Link from 'app/components/link';
import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {update, loadStatsForProject} from 'app/actionCreators/projects';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';
import overflowEllipsis from 'app/styles/overflowEllipsis';

import PlatformList from './platformList';
import Chart from './chart';
import NoEvents from './noEvents';

class ProjectCard extends React.Component {
  static propTypes = {
    project: SentryTypes.Project.isRequired,
    params: PropTypes.object,
  };

  componentDidMount() {
    const {project, params} = this.props;

    this.api = new Client();

    // fetch project stats
    loadStatsForProject(this.api, project.id, {
      orgId: params.orgId,
    });
  }

  toggleProjectBookmark = () => {
    const {project, params} = this.props;

    update(this.api, {
      orgId: params.orgId,
      projectId: project.slug,
      data: {
        isBookmarked: !project.isBookmarked,
      },
    }).catch(() => {
      addErrorMessage(t('Unable to toggle bookmark for %s', project.slug));
    });
  };

  render() {
    const {project, params} = this.props;
    const {stats} = project;

    const bookmarkText = project.isBookmarked
      ? t('Remove from bookmarks')
      : t('Add to bookmarks');

    return (
      <Box p={1} data-test-id={project.slug} width={['100%', '50%', '33%', '25%']}>
        {stats ? (
          <StyledProjectCard>
            <Flex justify="space-between" align="center">
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
        ) : (
          <LoadingCard />
        )}
      </Box>
    );
  }
}

const ProjectCardContainer = createReactClass({
  propTypes: {
    project: SentryTypes.Project,
  },
  mixins: [Reflux.listenTo(ProjectsStatsStore, 'onProjectStoreUpdate')],
  getInitialState() {
    const {project} = this.props;
    const initialState = ProjectsStatsStore.getInitialState() || {};
    return {
      projectDetails: initialState[project.slug] || null,
    };
  },
  onProjectStoreUpdate(itemsBySlug) {
    const {project} = this.props;

    // Don't update state if we already have stats
    if (!itemsBySlug[project.slug]) return;
    if (itemsBySlug[project.slug] === this.state.projectDetails) return;

    this.setState({
      projectDetails: itemsBySlug[project.slug],
    });
  },
  render() {
    const {project, ...props} = this.props;
    const {projectDetails} = this.state;
    return (
      <ProjectCard
        {...props}
        project={{
          ...project,
          ...(projectDetails || {}),
        }}
      />
    );
  },
});

const ChartContainer = styled.div`
  position: relative;
  background: ${p => p.theme.offWhite};
  padding-top: ${space(1)};
`;

const StyledLink = styled(Link)`
  ${overflowEllipsis};
  padding: 16px;
`;

const StyledProjectCard = styled.div`
  background-color: white;
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowLight};
`;

const Star = styled.a`
  color: ${p => (p.active ? p.theme.yellowOrange : '#afa3bb')};
  margin-right: 16px;
  &:hover {
    color: ${p => p.theme.yellowOrange};
    opacity: 0.6;
  }
`;

const LoadingCard = styled('div')`
  border: 1px solid transparent;
  background-color: ${p => p.theme.offWhite};
  height: 180px;
`;

export {ProjectCard};
export default withRouter(ProjectCardContainer);
