import React from 'react';
import styled, {css} from 'react-emotion';

import {getOrganizationState} from 'app/mixins/organizationState';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import {removeTeamFromProject, addTeamToProject} from 'app/actionCreators/projects';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Link from 'app/components/link';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TeamSelect from 'app/views/settings/components/teamSelect';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

class ProjectTeams extends AsyncView {
  getEndpoints() {
    const {orgId, projectId} = this.props.params;
    return [['projectTeams', `/projects/${orgId}/${projectId}/teams/`]];
  }

  canCreateTeam = () => {
    const {organization} = this.props;
    const access = getOrganizationState(organization).getAccess();
    return (
      access.has('org:write') && access.has('team:write') && access.has('project:write')
    );
  };

  handleRemove = team => {
    if (this.state.loading) {
      return;
    }

    const {orgId, projectId} = this.props.params;

    removeTeamFromProject(this.api, orgId, projectId, team.slug)
      .then(() => this.handleRemovedTeam(team))
      .catch(() => {
        addErrorMessage(t('Could not remove the %s team', team.slug));
        this.setState({loading: false});
      });
  };

  handleRemovedTeam = removedTeam => {
    this.setState(prevState => {
      return {
        projectTeams: this.state.projectTeams.filter(team => {
          return team.slug !== removedTeam.slug;
        }),
      };
    });
  };

  handleAddedTeam = team => {
    this.setState(prevState => {
      return {
        projectTeams: this.state.projectTeams.concat([team]),
      };
    });
  };

  handleAdd = team => {
    if (this.state.loading) {
      return;
    }
    const {orgId, projectId} = this.props.params;

    addTeamToProject(this.api, orgId, projectId, team).then(
      () => {
        this.handleAddedTeam(team);
      },
      () => {
        this.setState({
          error: true,
          loading: false,
        });
      }
    );
  };

  handleCreateTeam = e => {
    const {project, organization} = this.props;

    if (!this.canCreateTeam()) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    openCreateTeamModal({
      project,
      organization,
      onClose: data => {
        addTeamToProject(this.api, organization.slug, project.slug, data).then(
          this.remountComponent,
          this.remountComponent
        );
      },
    });
  };

  renderBody() {
    const {params, organization} = this.props;

    const canCreateTeam = this.canCreateTeam();
    const hasAccess = organization.access.includes('project:write');
    const confirmRemove = t(
      'This is the last team with access to this project. Removing it will mean ' +
        'only owners and managers will be able to access the project pages. Are ' +
        'you sure you want to remove this team from the project %s?',
      params.projectId
    );
    const projectTeams = this.state.projectTeams.map(p => p.slug);

    const menuHeader = (
      <StyledTeamsLabel>
        {t('Teams')}
        <Tooltip
          disabled={canCreateTeam}
          title={t('You must be a project admin to create teams')}
          tooltipOptions={{placement: 'top'}}
        >
          <StyledCreateTeamLink disabled={!canCreateTeam} onClick={this.handleCreateTeam}>
            {t('Create Team')}
          </StyledCreateTeamLink>
        </Tooltip>
      </StyledTeamsLabel>
    );

    return (
      <div>
        <SettingsPageHeader title={t('%s Teams', params.projectId)} />
        <TeamSelect
          organization={organization}
          selectedTeams={projectTeams}
          onAddTeam={this.handleAdd}
          onRemoveTeam={this.handleRemove}
          menuHeader={menuHeader}
          confirmLastTeamRemoveMessage={confirmRemove}
          disabled={!hasAccess}
        />
      </div>
    );
  }
}

const StyledTeamsLabel = styled('div')`
  font-size: 0.875em;
  padding: ${space(0.5)};
  text-transform: uppercase;
`;

const StyledCreateTeamLink = styled(Link)`
  float: right;
  text-transform: none;
  ${p =>
    p.disabled &&
    css`
      cursor: not-allowed;
      color: ${p.theme.gray2};
      opacity: 0.6;
    `};
`;

export default ProjectTeams;
