import React from 'react';
import PropTypes from 'prop-types';
import idx from 'idx';
import {Box} from 'grid-emotion';

import {t} from '../../../../locale';
import {getOrganizationState} from '../../../../mixins/organizationState';
import OrganizationSettingsView from '../../../organizationSettingsView';
import ProjectStatsGraph from './projectStatsGraph';
import SentryTypes from '../../../../proptypes';
import {sortProjects} from '../../../../utils';
import Panel from '../../components/panel';
import PanelItem from '../../components/panelItem';
import PanelHeader from '../../components/panelHeader';
import PanelBody from '../../components/panelBody';
import ProjectListItem from '../../../settings/components/settingsProjectItem';
import SettingsPageHeader from '../../components/settingsPageHeader';
import Button from '../../../../components/buttons/button';
import EmptyMessage from '../../components/emptyMessage';
import Pagination from '../../../../components/pagination';

export default class OrganizationProjectsView extends OrganizationSettingsView {
  static contextTypes = {
    router: PropTypes.object.isRequired,
    organization: SentryTypes.Organization,
  };

  getEndpoints() {
    let {orgId} = this.props.params;
    return [
      [
        'projectList',
        `/organizations/${orgId}/projects/`,
        {
          query: {
            query: idx(this.props, _ => _.location.query.query),
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
          },
        },
      ],
    ];
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      searchQuery: idx(this.props, _ => _.location.query.query),
    };
  }

  getTitle() {
    let org = this.context.organization;
    return `${org.name} Projects`;
  }

  onSearch = e => {
    let {router} = this.context;
    let {location} = this.props;
    e.preventDefault();
    router.push({
      pathname: location.pathname,
      query: {
        query: this.state.searchQuery,
      },
    });
  };

  renderBody() {
    let {projectList, projectListPageLinks, projectStats} = this.state;
    let {organization} = this.context;
    let canCreateProjects = getOrganizationState(this.context.organization)
      .getAccess()
      .has('project:admin');

    let action = (
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
        <Panel className="table table-no-top-border m-b-0">
          <PanelHeader>
            <form className="pull-right" onSubmit={this.onSearch}>
              <input
                value={this.state.searchQuery}
                onChange={e => this.setState({searchQuery: e.target.value})}
                className="search"
                placeholder="search"
              />
            </form>
            {t('Projects')}
          </PanelHeader>
          <PanelBody css={{width: '100%'}}>
            {sortProjects(projectList).map((project, i) => (
              <PanelItem p={0} key={project.id} align="center">
                <Box p={2} flex="1">
                  <ProjectListItem
                    project={project}
                    organization={this.context.organization}
                  />
                </Box>
                <Box w={3 / 12} p={2}>
                  <ProjectStatsGraph
                    key={project.id}
                    project={project}
                    stats={projectStats[project.id]}
                  />
                </Box>
                <Box p={2} align="right">
                  <Button size="small" to={`/${organization.slug}/${project.slug}/`}>
                    {t('View Issues')}
                  </Button>
                </Box>
              </PanelItem>
            ))}
            {projectList.length === 0 && (
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
