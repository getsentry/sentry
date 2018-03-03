import React from 'react';
import createReactClass from 'create-react-class';
import {Box} from 'grid-emotion';
import Reflux from 'reflux';
import styled from 'react-emotion';

import ApiMixin from '../../../mixins/apiMixin';
import Button from '../../../components/buttons/button';
import DropdownAutoComplete from '../../../components/dropdownAutoComplete';
import DropdownButton from '../../../components/dropdownButton';
import ProjectsStore from '../../../stores/projectsStore';
import TeamStore from '../../../stores/teamStore';
import IndicatorStore from '../../../stores/indicatorStore';
import TeamActions from '../../../actions/teamActions';
import LoadingError from '../../../components/loadingError';
import OrganizationState from '../../../mixins/organizationState';
import ProjectListItem from '../components/settingsProjectItem';
import Panel from '../components/panel';
import PanelItem from '../components/panelItem';
import PanelHeader from '../components/panelHeader';
import PanelBody from '../components/panelBody';

import {sortProjects} from '../../../utils';
import {t} from '../../../locale';

const PanelHeaderContentContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

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

  componentWillReceiveProps(nextProps) {
    let params = this.props.params;
    if (
      nextProps.params.teamId !== params.teamId ||
      nextProps.params.orgId !== params.orgId
    ) {
      this.setState(this.getInitialState());
    }
  },

  onProjectUpdate() {
    this.setState({
      allProjects: ProjectsStore.getAll(),
    });
  },

  onTeamUpdate() {
    this.setState({
      projectListLinked: TeamStore.getBySlug(this.props.params.teamId).projects,
    });
  },

  handleLinkProject(project, value) {
    let {orgId, teamId} = this.props.params;
    this.api.request(`/projects/${orgId}/${project.slug}/teams/${teamId}/`, {
      method: value === 'Add' ? 'POST' : 'DELETE',
      success: () => {
        let team = TeamStore.getBySlug(this.props.params.teamId);
        if (value == 'Add') {
          team.projects = [...team.projects, project];
        } else {
          team.projects = team.projects.filter(({id}) => id != project.id);
        }
        TeamActions.updateSuccess(0, teamId, team);
        IndicatorStore.add(t('Successfully added project to team.'), 'success', {
          duration: 2000,
        });
      },
      error: e => {
        IndicatorStore.addError("Wasn't able to change project association.");
      },
    });
  },

  handleProjectSelected(selection) {
    let project = this.state.allProjects.find(p => {
      return p.id === selection.value;
    });

    this.handleLinkProject(project, 'Add');
  },

  projectPanelcontents(projects, direction) {
    return sortProjects(projects).map((project, i) => (
      <PanelItem p={0} key={project.id} align="center">
        <Box p={2} flex="1">
          <ProjectListItem project={project} organization={this.context.organization} />
        </Box>
        <Box p={2}>
          <Button
            size="small"
            onClick={() => {
              this.handleLinkProject(project, direction);
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
    let linkedProjectIds = new Set(projectListLinked.map(p => p.id));

    let linkedProjects = allProjects.filter(p => linkedProjectIds.has(p.id));

    let otherProjects = allProjects
      .filter(p => {
        return !linkedProjectIds.has(p.id);
      })
      .map(p => {
        return {
          value: p.id,
          label: p.slug,
        };
      });

    return (
      <div>
        <Panel>
          <PanelHeader>
            <PanelHeaderContentContainer>
              {t('Projects')}
              <div style={{textTransform: 'none'}}>
                <DropdownAutoComplete
                  items={otherProjects}
                  onSelect={this.handleProjectSelected}
                >
                  {({isOpen, selectedItem}) => (
                    <DropdownButton isOpen={isOpen}>
                      <span className="icon-plus" />
                      {t('Add Project')}
                    </DropdownButton>
                  )}
                </DropdownAutoComplete>
              </div>
            </PanelHeaderContentContainer>
          </PanelHeader>
          <PanelBody>{this.projectPanelcontents(linkedProjects, 'Remove')}</PanelBody>
        </Panel>
      </div>
    );
  },
});

export default TeamProjects;
