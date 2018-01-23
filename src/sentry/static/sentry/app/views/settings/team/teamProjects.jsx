import React from 'react';
import createReactClass from 'create-react-class';
import {Box} from 'grid-emotion';
import Reflux from 'reflux';

import ApiMixin from '../../../mixins/apiMixin';
import ProjectsStore from '../../../stores/projectsStore';

import Button from '../../../components/buttons/button';
import LoadingError from '../../../components/loadingError';
import LoadingIndicator from '../../../components/loadingIndicator';
import OrganizationState from '../../../mixins/organizationState';
import ProjectListItem from '../components/settingsProjectItem';
import Panel from '../components/panel';
import PanelItem from '../components/panelItem';
import PanelHeader from '../components/panelHeader';

import {t} from '../../../locale';

const TeamProjects = createReactClass({
  displayName: 'TeamProjects',
  mixins: [
    ApiMixin,
    OrganizationState,
    Reflux.listenTo(ProjectsStore, 'onProjectUpdate'),
  ],

  getInitialState() {
    return {
      allProjects: Array.from(ProjectsStore.getAll().values()),
      loading: true,
      error: false,
      projectListLinked: [],
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    let params = this.props.params;
    if (
      nextProps.params.teamId !== params.teamId ||
      nextProps.params.orgId !== params.orgId
    ) {
      this.setState(
        {
          loading: true,
          error: false,
        },
        this.fetchData
      );
    }
  },

  fetchData() {
    let params = this.props.params;
    this.api.request(`/teams/${params.orgId}/${params.teamId}/projects/`, {
      success: data => {
        this.setState({
          projectListLinked: data,
          loading: false,
          error: false,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  onProjectUpdate(projects) {
    this.setState({
      allProjects: Array.from(ProjectsStore.getAll().values()),
    });
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    let {projectListLinked, allProjects} = this.state;
    let linkedProjects = allProjects.filter(p =>
      projectListLinked.find(l => l.id === p.id)
    );
    let otherProjects = allProjects.filter(
      p => !projectListLinked.find(l => l.id === p.id)
    );

    return (
      <div>
        <Panel>
          {linkedProjects
            .sort(({isBookmarked}) => (isBookmarked ? -1 : 1))
            .map((project, i) => (
              <PanelItem key={i} align="center">
                <Box w={1 / 2} p={2}>
                  <ProjectListItem
                    project={project}
                    organization={this.context.organization}
                  />
                </Box>
                <Box w={1 / 2} p={2} style={{textAlign: 'right'}}>
                  <Button size="small" className="pull-right">
                    Remove
                  </Button>
                </Box>
              </PanelItem>
            ))}
        </Panel>
        <Panel>
          <PanelHeader>{t('Other Projects:')}</PanelHeader>
          {otherProjects
            .sort(({isBookmarked}) => (isBookmarked ? -1 : 1))
            .map((project, i) => (
              <PanelItem key={i} align="center">
                <Box w={1 / 2} p={2}>
                  <ProjectListItem
                    project={project}
                    organization={this.context.organization}
                  />
                </Box>
                <Box w={1 / 2} p={2} style={{textAlign: 'right'}}>
                  <Button size="small" className="pull-right">
                    Add
                  </Button>
                </Box>
              </PanelItem>
            ))}
        </Panel>
      </div>
    );
  },
});

export default TeamProjects;
