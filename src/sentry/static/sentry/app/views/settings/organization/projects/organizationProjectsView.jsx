import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {Box} from 'grid-emotion';

import {loadStats} from '../../../../actionCreators/projects';
import {t} from '../../../../locale';
import ApiMixin from '../../../../mixins/apiMixin';
import OrganizationSettingsView from '../../../organizationSettingsView';
import ProjectStatsGraph from './projectStatsGraph';
import ProjectsStore from '../../../../stores/projectsStore';
import SentryTypes from '../../../../proptypes';
import {sortProjects} from '../../../../utils';
import Panel from '../../components/panel';
import PanelItem from '../../components/panelItem';
import PanelHeader from '../../components/panelHeader';
import PanelBody from '../../components/panelBody';
import ProjectListItem from '../../../settings/components/settingsProjectItem';
import SettingsPageHeader from '../../components/settingsPageHeader';
import Button from '../../../../components/buttons/button';

class OrganizationProjectsView extends OrganizationSettingsView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  getTitle() {
    let org = this.context.organization;
    return `${org.name} Projects`;
  }

  renderBody() {
    let {projects} = this.props;
    let {organization} = this.context;
    let {access} = organization;
    let canCreateProjects = access.indexOf('org:write') > -1;

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
      >
        <span className="icon-plus" /> {t('Create Project')}
      </Button>
    );

    return (
      <div>
        <SettingsPageHeader title="Projects" action={action} />
        <Panel className="table table-no-top-border m-b-0">
          <PanelHeader>{t('Projects')}</PanelHeader>
          <PanelBody css={{width: '100%'}}>
            {sortProjects(projects).map((project, i) => (
              <PanelItem key={project.id} align="center">
                <Box w={1 / 2} p={2} flex="1">
                  <ProjectListItem
                    project={project}
                    organization={this.context.organization}
                  />
                </Box>
                <Box w={1 / 2} p={2}>
                  <ProjectStatsGraph key={project.id} project={project} />
                </Box>
              </PanelItem>
            ))}
            {projects.length === 0 && (
              <PanelItem align="center">
                <Box w={1 / 2} p={2} flex="1">
                  <span>{t('No projects found.')}</span>
                </Box>
              </PanelItem>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

const OrganizationProjectsViewContainer = createReactClass({
  displayName: 'OrganizationProjectsViewContainer',
  mixins: [ApiMixin, Reflux.listenTo(ProjectsStore, 'onProjectUpdate')],

  getInitialState() {
    return {
      projects: ProjectsStore.getAll(),
    };
  },

  componentDidMount() {
    loadStats(this.api, {
      orgId: this.props.params.orgId,
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'generated',
        group: 'project',
      },
    });
  },

  onProjectUpdate() {
    this.setState({
      projects: ProjectsStore.getAll(),
    });
  },

  render() {
    return <OrganizationProjectsView {...this.props} projects={this.state.projects} />;
  },
});

export default OrganizationProjectsViewContainer;
