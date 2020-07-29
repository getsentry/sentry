import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';

import {Organization, Project} from 'app/types';
import BookmarkStar from 'app/components/projects/bookmarkStar';
import {Client} from 'app/api';
import {loadStatsForProject} from 'app/actionCreators/projects';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import withApi from 'app/utils/withApi';

import Chart from './chart';
import Deploys from './deploys';
import NoEvents from './noEvents';

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
  hasProjectAccess: boolean;
};

class ProjectCard extends React.Component<Props> {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project.isRequired,
    hasProjectAccess: PropTypes.bool,
  };

  componentDidMount() {
    const {organization, project, api} = this.props;

    // fetch project stats
    loadStatsForProject(api, project.id, {
      orgId: organization.slug,
      projectId: project.id,
    });
  }

  render() {
    const {organization, project, hasProjectAccess} = this.props;
    const {id, firstEvent, stats, slug} = project;

    return (
      <div data-test-id={slug}>
        {stats ? (
          <StyledProjectCard>
            <StyledProjectCardHeader>
              <StyledIdBadge
                project={project}
                avatarSize={18}
                displayName={
                  hasProjectAccess ? (
                    <Link
                      to={`/organizations/${organization.slug}/issues/?project=${id}`}
                    >
                      <strong>{slug}</strong>
                    </Link>
                  ) : (
                    <span>{slug}</span>
                  )
                }
              />
              <BookmarkStar organization={organization} project={project} />
            </StyledProjectCardHeader>
            <ChartContainer>
              <Chart stats={stats} />
              {!firstEvent && <NoEvents />}
            </ChartContainer>
            <Deploys project={project} />
          </StyledProjectCard>
        ) : (
          <LoadingCard />
        )}
      </div>
    );
  }
}

type ContainerProps = {
  api: Client;
  project: Project;
  organization: Organization;
  hasProjectAccess: boolean;
};

type ContainerState = {
  projectDetails: Project | null;
};

const ProjectCardContainer = createReactClass<ContainerProps, ContainerState>({
  propTypes: {
    project: SentryTypes.Project,
  },
  mixins: [Reflux.listenTo(ProjectsStatsStore, 'onProjectStoreUpdate') as any],
  getInitialState(): ContainerState {
    const {project} = this.props;
    const initialState = ProjectsStatsStore.getInitialState() || {};
    return {
      projectDetails: initialState[project.slug] || null,
    };
  },
  onProjectStoreUpdate(itemsBySlug: typeof ProjectsStatsStore['itemsBySlug']) {
    const {project} = this.props;

    // Don't update state if we already have stats
    if (!itemsBySlug[project.slug]) {
      return;
    }
    if (itemsBySlug[project.slug] === this.state.projectDetails) {
      return;
    }

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

const ChartContainer = styled('div')`
  position: relative;
  background: ${p => p.theme.gray100};
  padding-top: ${space(1)};
`;

const StyledProjectCardHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 12px ${space(2)};
`;

const StyledProjectCard = styled('div')`
  background-color: white;
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowLight};
`;

const LoadingCard = styled('div')`
  border: 1px solid transparent;
  background-color: ${p => p.theme.gray100};
  height: 210px;
`;

const StyledIdBadge = styled(IdBadge)`
  overflow: hidden;
  white-space: nowrap;
`;

export {ProjectCard};
export default withOrganization(withApi(ProjectCardContainer));
