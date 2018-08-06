import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import idx from 'idx';

import {getOrganizationState} from 'app/mixins/organizationState';
import {sortProjects} from 'app/utils';
import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import AsyncView from 'app/views/asyncView';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import ProjectListItem from 'app/views/settings/components/settingsProjectItem';
import SentryTypes from 'app/sentryTypes';
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

  /**
   * This is called when "Enter" (more specifically a "submit" event) is pressed.
   * Update the URL to reflect search term.
   */
  handleSearch = (query, e) => {
    let {router} = this.context;
    let {location} = this.props;
    e.preventDefault();
    router.push({
      pathname: location.pathname,
      query: {
        query,
      },
    });
  };

  renderBody() {
    let {projectList, projectListPageLinks, projectStats} = this.state;
    let {organization} = this.context;
    let canCreateProjects = getOrganizationState(this.context.organization)
      .getAccess()
      .has('project:admin');
    let [stateKey, url] = this.getEndpoints()[0];

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

            {this.renderSearchInput({
              onSearchSubmit: this.handleSearch,
              placeholder: t('Search Projects'),
              className: 'search',
              url,
              stateKey,
            })}
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
