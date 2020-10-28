import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {addTeamToProject, removeTeamFromProject} from 'app/actionCreators/projects';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Link from 'app/components/links/link';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TeamSelect from 'app/views/settings/components/teamSelect';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import routeTitleGen from 'app/utils/routeTitle';

class ProjectTeams extends AsyncView {
  getEndpoints() {
    const {orgId, projectId} = this.props.params;
    return [['projectTeams', `/projects/${orgId}/${projectId}/teams/`]];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Project Teams'), projectId, false);
  }

  canCreateTeam = () => {
    const {organization} = this.props;
    const access = new Set(organization.access);
    return (
      access.has('org:write') && access.has('team:write') && access.has('project:write')
    );
  };

  handleRemove = teamSlug => {
    if (this.state.loading) {
      return;
    }

    const {orgId, projectId} = this.props.params;

    removeTeamFromProject(this.api, orgId, projectId, teamSlug)
      .then(() => this.handleRemovedTeam(teamSlug))
      .catch(() => {
        addErrorMessage(t('Could not remove the %s team', teamSlug));
        this.setState({loading: false});
      });
  };

  handleRemovedTeam = teamSlug => {
    this.setState(() => ({
      projectTeams: this.state.projectTeams.filter(team => team.slug !== teamSlug),
    }));
  };

  handleAddedTeam = team => {
    this.setState(() => ({
      projectTeams: this.state.projectTeams.concat([team]),
    }));
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
        'only organization owners and managers will be able to access the project pages. Are ' +
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
          position="top"
        >
          <StyledCreateTeamLink
            to=""
            disabled={!canCreateTeam}
            onClick={this.handleCreateTeam}
          >
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
      color: ${p.theme.gray500};
      opacity: 0.6;
    `};
`;

export default ProjectTeams;
