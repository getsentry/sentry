import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'app/components/button';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {sortProjects} from 'app/utils';
import {decodeScalar} from 'app/utils/queryString';
import routeTitleGen from 'app/utils/routeTitle';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import ProjectListItem from 'app/views/settings/components/settingsProjectItem';

import ProjectStatsGraph from './projectStatsGraph';

const ITEMS_PER_PAGE = 50;

type Props = {
  organization: Organization;
  location: Location;
} & RouteComponentProps<{orgId: string}, {}>;

type ProjectStats = Record<string, Required<Project['stats']>>;

type State = AsyncView['state'] & {
  projectList: Project[] | null;
  projectListPageLinks: string | null;
  projectStats: ProjectStats | null;
};

class OrganizationProjects extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId} = this.props.params;
    const {location} = this.props;
    const query = decodeScalar(location.query.query);
    return [
      [
        'projectList',
        `/organizations/${orgId}/projects/`,
        {
          query: {
            query,
            per_page: ITEMS_PER_PAGE,
          },
        },
      ],
      [
        'projectStats',
        `/organizations/${orgId}/stats/`,
        {
          query: {
            since: new Date().getTime() / 1000 - 3600 * 24,
            stat: 'generated',
            group: 'project',
            per_page: ITEMS_PER_PAGE,
          },
        },
      ],
    ];
  }

  getTitle(): string {
    const {organization} = this.props;
    return routeTitleGen(t('Projects'), organization.slug, false);
  }

  renderLoading(): React.ReactNode {
    return this.renderBody();
  }

  renderBody(): React.ReactNode {
    const {projectList, projectListPageLinks, projectStats} = this.state;
    const {organization} = this.props;
    const canCreateProjects = new Set(organization.access).has('project:admin');

    const action = (
      <Button
        priority="primary"
        size="small"
        disabled={!canCreateProjects}
        title={
          !canCreateProjects
            ? t('You do not have permission to create projects')
            : undefined
        }
        to={`/organizations/${organization.slug}/projects/new/`}
        icon={<IconAdd size="xs" isCircled />}
      >
        {t('Create Project')}
      </Button>
    );

    return (
      <React.Fragment>
        <SettingsPageHeader title="Projects" action={action} />
        <Panel>
          <PanelHeader hasButtons>
            {t('Projects')}

            {this.renderSearchInput({
              updateRoute: true,
              placeholder: t('Search Projects'),
              className: 'search',
            })}
          </PanelHeader>
          <PanelBody>
            {projectList ? (
              sortProjects(projectList).map(project => (
                <GridPanelItem key={project.id}>
                  <ProjectListItemWrapper>
                    <ProjectListItem project={project} organization={organization} />
                  </ProjectListItemWrapper>
                  <ProjectStatsGraphWrapper>
                    {projectStats ? (
                      <ProjectStatsGraph
                        key={project.id}
                        project={project}
                        stats={projectStats[project.id]}
                      />
                    ) : (
                      <Placeholder height="25px" />
                    )}
                  </ProjectStatsGraphWrapper>
                </GridPanelItem>
              ))
            ) : (
              <LoadingIndicator />
            )}
            {projectList && projectList.length === 0 && (
              <EmptyMessage>{t('No projects found.')}</EmptyMessage>
            )}
          </PanelBody>
        </Panel>
        {projectListPageLinks && (
          <Pagination pageLinks={projectListPageLinks} {...this.props} />
        )}
      </React.Fragment>
    );
  }
}

export default withOrganization(OrganizationProjects);

const GridPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  padding: 0;
`;

const ProjectListItemWrapper = styled('div')`
  padding: ${space(2)};
  flex: 1;
`;

const ProjectStatsGraphWrapper = styled('div')`
  padding: ${space(2)};
  width: 25%;
  margin-left: ${space(2)};
`;
