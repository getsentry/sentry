import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import idx from 'idx';
import {debounce} from 'lodash';

import {getOrganizationState} from 'app/mixins/organizationState';
import {sortProjects} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Input from 'app/views/settings/components/forms/controls/input';
import AsyncView from 'app/views/asyncView';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import ProjectListItem from 'app/views/settings/components/settingsProjectItem';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

import ProjectStatsGraph from './projectStatsGraph';

export default class OrganizationProjects extends AsyncView {
  static contextTypes = {
    router: PropTypes.object.isRequired,
    organization: SentryTypes.Organization,
  };

  componentWillReceiveProps(nextProps, nextContext) {
    super.componentWillReceiveProps(nextProps, nextContext);
    let searchQuery = idx(nextProps, _ => _.location.query.query);
    if (searchQuery !== idx(this.props, _ => _.location.query.query)) {
      this.setState({searchQuery});
    }
  }

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
      searchQuery: idx(this.props, _ => _.location.query.query) || '',
    };
  }

  getTitle() {
    let org = this.context.organization;
    return `${org.name} Projects`;
  }

  handleChange = evt => {
    let searchQuery = evt.target.value;
    this.getProjects(searchQuery);
    this.setState({searchQuery});
  };

  getProjects = debounce(searchQuery => {
    let {params} = this.props;
    let {orgId} = params || {};

    this.api.request(`/organizations/${orgId}/projects/?query=${searchQuery}`, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.handleRequestSuccess({stateKey: 'projectList', data, jqXHR});
      },
    });
  }, 200);

  handleSearch = e => {
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
        <Panel>
          <PanelHeader hasButtons>
            {t('Projects')}

            <form onSubmit={this.handleSearch}>
              <Input
                value={this.state.searchQuery}
                onChange={this.handleChange}
                className="search"
                placeholder={t('Search Projects')}
              />
            </form>
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
