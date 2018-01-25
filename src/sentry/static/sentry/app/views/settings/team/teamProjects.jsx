import React from 'react';
import createReactClass from 'create-react-class';
import {Box} from 'grid-emotion';
import Reflux from 'reflux';

import ApiMixin from '../../../mixins/apiMixin';
import ProjectsStore from '../../../stores/projectsStore';
import TeamStore from '../../../stores/teamStore';
import IndicatorStore from '../../../stores/indicatorStore';
import TeamActions from '../../../actions/teamActions';

import Button from '../../../components/buttons/button';
import LoadingError from '../../../components/loadingError';
import OrganizationState from '../../../mixins/organizationState';
import ProjectListItem from '../components/settingsProjectItem';
import Panel from '../components/panel';
import PanelItem from '../components/panelItem';
import PanelHeader from '../components/panelHeader';

import {sortProjects} from '../../../utils.jsx';
import {t} from '../../../locale';

const TeamProjects = createReactClass({
  displayName: 'TeamProjects',
  mixins: [
    ApiMixin,
    OrganizationState,
    Reflux.listenTo(ProjectsStore, 'onProjectUpdate'),
    Reflux.listenTo(TeamStore, 'onTeamUpdate'),
  ],

  getInitialState() {
    let team = TeamStore.getBySlug(this.props.params.teamId);
    return {
      allProjects: ProjectsStore.getAll(),
      error: false,
      projectListLinked: team ? team.projects : [],
    };
  },

  componentWillMount() {
    // this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    let params = this.props.params;
    if (
      nextProps.params.teamId !== params.teamId ||
      nextProps.params.orgId !== params.orgId
    ) {
      this.setState(this.getInitialState());
      // , this.fetchData);
    }
  },

  // fetchData() {
  //   let params = this.props.params;
  //   // fetchTeamDetails(this.api, this.props.params);
  //   this.api.request(`/teams/${params.orgId}/${params.teamId}/projects/`, {
  //     success: data => {
  //       this.setState({
  //         projectListLinked: data,
  //         error: false,
  //       });
  //     },
  //     error: error => {
  //       console.log(error);
  //       this.setState({
  //         error: true,
  //       });
  //     },
  //   });
  // },

  onProjectUpdate(projects) {
    this.setState({
      allProjects: ProjectsStore.getAll(),
    });
  },

  onTeamUpdate(teams) {
    console.log(teams);
    this.setState({
      projectListLinked: TeamStore.getBySlug(this.props.params.teamId).projects,
    });
  },

  linkProject(project, value) {
    let {orgId, teamId} = this.props.params;
    // console.log(teamId, project.slug);
    this.api.request(`/projects/${orgId}/${project.slug}/teams/${teamId}/`, {
      method: value === 'Add' ? 'POST' : 'DELETE',
      success: () => {
        let team = TeamStore.getBySlug(this.props.params.teamId);
        if (value == 'Add') {
          team.projects = [...team.projects, project];
        } else {
          team.projects = team.projects.filter(({id}) => id != project.id);
        }
        // console.log(team);
        TeamActions.updateSuccess(0, teamId, team);
      },
      error: e => {
        console.log(value, `/projects/${orgId}/${project.slug}/teams/${teamId}/`);
        IndicatorStore.addError("Wasn't able to change project association.");
        // this.setState({});
      },
    });
  },

  projectPanelcontents(projects, direction) {
    return sortProjects(projects).map((project, i) => (
      <PanelItem key={i} align="center">
        <Box w={1 / 2} p={2}>
          <ProjectListItem project={project} organization={this.context.organization} />
        </Box>
        <Box w={1 / 2} p={2} style={{textAlign: 'right'}}>
          <Button
            size="small"
            className="pull-right"
            onClick={() => {
              this.linkProject(project, direction);
            }}
          >
            {direction}
          </Button>
        </Box>
      </PanelItem>
    ));
  },

  render() {
    if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    let {projectListLinked, allProjects} = this.state;
    console.log(projectListLinked);
    let linkedProjects = allProjects.filter(p =>
      projectListLinked.find(l => l.id === p.id)
    );
    let otherProjects = allProjects.filter(
      p => !projectListLinked.find(l => l.id === p.id)
    );

    return (
      <div>
        <Panel>
          <PanelHeader>{t('Associated Projects:')}</PanelHeader>
          {this.projectPanelcontents(linkedProjects, 'Remove')}
        </Panel>
        <Panel>
          <PanelHeader>{t('Other Projects:')}</PanelHeader>
          {this.projectPanelcontents(otherProjects, 'Add')}
        </Panel>
      </div>
    );
  },
});

export default TeamProjects;
