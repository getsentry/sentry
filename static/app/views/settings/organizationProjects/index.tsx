import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {sortProjects} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView, {AsyncViewState} from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ProjectListItem from 'sentry/views/settings/components/settingsProjectItem';
import CreateProjectButton from 'sentry/views/settings/organizationProjects/createProjectButton';

import ProjectStatsGraph from './projectStatsGraph';

const ITEMS_PER_PAGE = 50;

interface Props extends RouteComponentProps<{}, {}> {
  location: Location;
  organization: Organization;
}

type ProjectStats = Record<string, Required<Project['stats']>>;

interface State extends AsyncViewState {
  projectList: Project[] | null;
  projectListPageLinks: string | null;
  projectStats: ProjectStats | null;
}

class OrganizationProjects extends DeprecatedAsyncView<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
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

    const action = <CreateProjectButton />;

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
