import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import styled from 'react-emotion';

import Tooltip from 'app/components/tooltip';
import ApiMixin from 'app/mixins/apiMixin';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import space from 'app/styles/space';
import Button from 'app/components/buttons/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ProjectsStore from 'app/stores/projectsStore';
import LoadingError from 'app/components/loadingError';
import OrganizationState from 'app/mixins/organizationState';
import ProjectListItem from 'app/views/settings/components/settingsProjectItem';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import InlineSvg from 'app/components/inlineSvg';
import {sortProjects} from 'app/utils';
import {t} from 'app/locale';

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
    let access = this.getAccess();
    let canWrite = access.has('org:write');

    return projects.length ? (
      sortProjects(projects).map((project, i) => (
        <StyledPanelItem key={project.id}>
          <ProjectListItem project={project} organization={this.context.organization} />
          <Tooltip
            disabled={canWrite}
            title={t('You do not have enough permission to change project association.')}
          >
            <Button
              size="small"
              disabled={!canWrite}
              onClick={() => {
                this.handleLinkProject(project, 'remove');
              }}
            >
              <RemoveIcon /> {t('Remove')}
            </Button>
          </Tooltip>
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
    let access = this.getAccess();

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
        <PanelHeader hasButtons={true}>
          <div>{t('Projects')}</div>
          <div style={{textTransform: 'none'}}>
            {!access.has('org:write') ? (
              <DropdownButton
                disabled
                title={t('You do not have enough permission to associate a project.')}
                size="xsmall"
              >
                {t('Add Project')}
              </DropdownButton>
            ) : (
              <DropdownAutoComplete
                items={otherProjects}
                onSelect={this.handleProjectSelected}
                emptyMessage={t('No projects')}
              >
                {({isOpen, selectedItem}) => (
                  <DropdownButton isOpen={isOpen} size="xsmall">
                    {t('Add Project')}
                  </DropdownButton>
                )}
              </DropdownAutoComplete>
            )}
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
