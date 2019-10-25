import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {sortProjects} from 'app/utils';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import ProjectListItem from 'app/views/settings/components/settingsProjectItem';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import routeTitleGen from 'app/utils/routeTitle';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

import ProjectStatsGraph from './projectStatsGraph';

class OrganizationProjects extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  static contextTypes = {
    router: PropTypes.object.isRequired,
  };

  componentWillReceiveProps(nextProps, nextContext) {
    super.componentWillReceiveProps(nextProps, nextContext);
    const searchQuery = nextProps.location.query.query;
    if (searchQuery !== this.props.location.query.query) {
      this.setState({searchQuery});
    }
  }

  getEndpoints() {
    const {orgId} = this.props.params;
    const itemsPerPage = 50;
    return [
      [
        'projectList',
        `/organizations/${orgId}/projects/`,
        {
          query: {
            query: this.props.location.query.query,
            per_page: itemsPerPage,
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
            per_page: itemsPerPage,
          },
        },
      ],
    ];
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      searchQuery: this.props.location.query.query || '',
    };
  }

  getTitle() {
    const {organization} = this.props;
    return routeTitleGen(t('Projects'), organization.slug, false);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
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
        icon="icon-circle-add"
      >
        {t('Create Project')}
      </Button>
    );

    return (
      <div>
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
          <PanelBody css={{width: '100%'}}>
            {projectList ? (
              sortProjects(projectList).map(project => (
                <GridPanelItem key={project.id}>
                  <ContainerProjectListItem>
                    <ProjectListItem project={project} organization={organization} />
                  </ContainerProjectListItem>
                  <ContainerProjectStatsGraph>
                    {projectStats ? (
                      <ProjectStatsGraph
                        key={project.id}
                        project={project}
                        stats={projectStats[project.id]}
                      />
                    ) : (
                      <Placeholder height="25px" />
                    )}
                  </ContainerProjectStatsGraph>
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
      </div>
    );
  }
}

export default withOrganization(OrganizationProjects);

const GridPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  padding: 0;
`;

const ContainerProjectListItem = styled('div')`
  padding: ${space(2)};
  flex: 1;
`;

const ContainerProjectStatsGraph = styled('div')`
  padding: ${space(2)};
  width: 25%;
`;
