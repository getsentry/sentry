import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import styled from 'react-emotion';

import ApiMixin from '../../../mixins/apiMixin';
import {addErrorMessage, addSuccessMessage} from '../../../actionCreators/indicator';
import space from '../../../styles/spacingScale';
import Button from '../../../components/buttons/button';
import DropdownAutoComplete from '../../../components/dropdownAutoComplete';
import DropdownButton from '../../../components/dropdownButton';
import EmptyMessage from '../components/emptyMessage';
import ProjectsStore from '../../../stores/projectsStore';
import LoadingError from '../../../components/loadingError';
import OrganizationState from '../../../mixins/organizationState';
import ProjectListItem from '../components/settingsProjectItem';
import {Panel, PanelHeader, PanelBody, PanelItem} from '../../../components/panels';
import InlineSvg from '../../../components/inlineSvg';

import {sortProjects} from '../../../utils';
import {t} from '../../../locale';

const TeamProjects = createReactClass({
  displayName: 'TeamProjects',
  mixins: [
    ApiMixin,
    OrganizationState,
    Reflux.listenTo(ProjectsStore, 'onProjectUpdate'),
  ],

  getInitialState() {
    let {teamId} = this.props.params;
    let projectList = ProjectsStore.getAll();
    return {
      allProjects: projectList,
      error: false,
      projectListLinked: projectList.filter(p => p.teams.find(t1 => teamId === t1.slug)),
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
    let {teamId} = this.props.params;
    let projectList = ProjectsStore.getAll();
    this.setState({
      allProjects: projectList,
      projectListLinked: projectList.filter(p => p.teams.find(t1 => teamId === t1.slug)),
    });
  },

  handleLinkProject(project, action) {
    let {orgId, teamId} = this.props.params;
    this.api.request(`/projects/${orgId}/${project.slug}/teams/${teamId}/`, {
      method: action === 'add' ? 'POST' : 'DELETE',
      success: data => {
        ProjectsStore.onUpdateSuccess(data);
        addSuccessMessage(
          action === 'add'
            ? t('Successfully added project to team.')
            : t('Successfully removed project from team')
        );
      },
      error: e => {
        addErrorMessage(t("Wasn't able to change project association."));
      },
    });
  },

  handleProjectSelected(selection) {
    let project = this.state.allProjects.find(p => {
      return p.id === selection.value;
    });

    this.handleLinkProject(project, 'add');
  },

  projectPanelcontents(projects) {
    return projects.length ? (
      sortProjects(projects).map((project, i) => (
        <StyledPanelItem key={project.id}>
          <ProjectListItem project={project} organization={this.context.organization} />
          <Button
            size="small"
            onClick={() => {
              this.handleLinkProject(project, 'remove');
            }}
          >
            <RemoveIcon /> {t('Remove')}
          </Button>
        </StyledPanelItem>
      ))
    ) : (
      <EmptyMessage size="large" icon="icon-circle-exclamation">
        {t("This team doesn't have access to any projects.")}
      </EmptyMessage>
    );
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
          searchKey: p.slug,
          label: <ProjectListElement>{p.slug}</ProjectListElement>,
        };
      });

    return (
      <Panel>
        <PanelHeader hasButtons={true} alignItems="center" justifyContent="space-between">
          <div>{t('Projects')}</div>
          <div style={{textTransform: 'none'}}>
            <DropdownAutoComplete
              items={otherProjects}
              onSelect={this.handleProjectSelected}
            >
              {({isOpen, selectedItem}) => (
                <DropdownButton isOpen={isOpen} size="xsmall">
                  {t('Add Project')}
                </DropdownButton>
              )}
            </DropdownAutoComplete>
          </div>
        </PanelHeader>
        <PanelBody>{this.projectPanelcontents(linkedProjects)}</PanelBody>
      </Panel>
    );
  },
});

const RemoveIcon = styled(props => (
  <InlineSvg {...props} src="icon-circle-subtract">
    {t('Remove')}
  </InlineSvg>
))`
  min-height: 1.25em;
  min-width: 1.25em;
  margin-right: ${space(1)};
`;

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(2)};
`;

const ProjectListElement = styled('div')`
  padding: ${space(0.25)} 0;
`;

export default TeamProjects;
