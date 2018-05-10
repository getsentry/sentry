import createReactClass from 'create-react-class';
import React from 'react';
import Reflux from 'reflux';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {withRouter} from 'react-router';
import {Flex, Box} from 'grid-emotion';

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
    projectDetails: SentryTypes.Project,
    stats: PropTypes.array,
    params: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      projectDetails: null,
    };
  }

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
    });
  };

  render() {
    const {project, projectDetails, stats, params} = this.props;

    const bookmarkText = project.isBookmarked
      ? t('Remove from bookmarks')
      : t('Add to bookmarks');

    return (
      <ProjectCardWrapper
        data-test-id={project.slug}
        width={['100%', '50%', '33%', '25%']}
      >
        {stats === null && <LoadingCard />}
        {stats && (
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
              {!stats ? (
                <NoStats>{t('Project stats are not available at the moment.')}</NoStats>
              ) : (
                <Chart stats={stats} noEvents={!project.firstEvent} />
              )}
              {!project.firstEvent && <NoEvents />}
            </ChartContainer>
            <PlatformList project={projectDetails} orgId={params.orgId} />
          </StyledProjectCard>
        )}
      </ProjectCardWrapper>
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
      projectDetails: initialState[project.id] || null,
    };
  },
  onProjectStoreUpdate(itemsById) {
    const {project} = this.props;

    // Don't update state if we already have stats
    if (!!this.state.projectDetails) return;
    if (!itemsById[project.id]) return;

    this.setState({
      projectDetails: itemsById[project.id],
    });
  },
  render() {
    const {projectDetails} = this.state;
    return (
      <ProjectCard
        {...this.props}
        projectDetails={projectDetails}
        stats={projectDetails && projectDetails.stats}
      />
    );
  },
});

const NoStats = styled('div')`
  background-color: rgba(255, 255, 255);
  font-weight: bold;
  font-size: 0.8em;
  text-align: center;
  opacity: 0.4;
  padding: 18px 0;
`;

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

const ProjectCardWrapper = styled(Box)`
  padding: 8px;
`;

const LoadingCard = styled('div')`
  border: 1px solid transparent;
  background-color: ${p => p.theme.offWhite};
  height: 180px;
`;

export {ProjectCard};
export default withRouter(ProjectCardContainer);
