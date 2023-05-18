import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {canCreateProject} from 'sentry/components/projects/utils';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {sortProjects} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ProjectListItem from 'sentry/views/settings/components/settingsProjectItem';

import ProjectStatsGraph from './projectStatsGraph';

const ITEMS_PER_PAGE = 50;

type Props = {
  location: Location;
  organization: Organization;
} & RouteComponentProps<{}, {}>;

type ProjectStats = Record<string, Required<Project['stats']>>;

type State = AsyncView['state'] & {
  projectList: Project[] | null;
  projectListPageLinks: string | null;
  projectStats: ProjectStats | null;
};

class OrganizationProjects extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {location, organization} = this.props;
    const query = decodeScalar(location.query.query);
    return [
      [
        'projectList',
        `/organizations/${organization.slug}/projects/`,
        {
          query: {
            query,
            per_page: ITEMS_PER_PAGE,
          },
        },
      ],
      [
        'projectStats',
        `/organizations/${organization.slug}/stats/`,
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
    const canCreateProjects = canCreateProject(organization);

    const action = (
      <Button
        priority="primary"
        size="sm"
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
      <Fragment>
        <SettingsPageHeader title="Projects" action={action} />
        <SearchWrapper>
          {this.renderSearchInput({
            updateRoute: true,
            placeholder: t('Search Projects'),
            className: 'search',
          })}
        </SearchWrapper>
        <Panel>
          <PanelHeader>{t('Projects')}</PanelHeader>
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
      </Fragment>
    );
  }
}

export default withOrganization(OrganizationProjects);

const SearchWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

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
