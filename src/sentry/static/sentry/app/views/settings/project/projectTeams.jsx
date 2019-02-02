import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled, {css} from 'react-emotion';
import * as Sentry from '@sentry/browser';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {getOrganizationState} from 'app/mixins/organizationState';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import {removeTeamFromProject, addTeamToProject} from 'app/actionCreators/projects';
import {t, tct} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Link from 'app/components/link';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

const TeamRow = createReactClass({
  displayName: 'TeamRow',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    team: PropTypes.object.isRequired,
    access: PropTypes.object.isRequired,
    onRemove: PropTypes.func.isRequired,
    teamCount: PropTypes.number.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
      error: false,
    };
  },

  handleRemove() {
    if (this.state.loading) return;

    const {orgId, projectId, team} = this.props;

    removeTeamFromProject(this.api, orgId, projectId, team.slug)
      .then(() => this.props.onRemove())
      .catch(() => {
        this.setState({
          error: true,
          loading: false,
        });
      });
  },

  render() {
    const {team, access, orgId, projectId} = this.props;
    const hasAccess = access.has('project:write');

    return (
      <PanelItem p={2} align="center">
        <Box flex={1}>
          <Link to={`/settings/${orgId}/teams/${team.slug}/`}>#{team.slug}</Link>
        </Box>
        <Confirm
          message={tct(
            'This is the last team with access to this project. Removing it will mean ' +
              'only owners and managers will be able to access the project pages. Are ' +
              'you sure you want to remove this team from the project [projectId]?',
            {projectId}
          )}
          bypass={this.props.teamCount > 1}
          onConfirm={this.handleRemove}
          disabled={!hasAccess || this.state.loading}
        >
          <Button
            size="xsmall"
            icon="icon-circle-subtract"
            disabled={!hasAccess || this.state.loading}
          >
            {t('Remove')}
          </Button>
        </Confirm>
      </PanelItem>
    );
  },
});

class ProjectTeams extends AsyncView {
  getEndpoints() {
    const {orgId, projectId} = this.props.params;
    return [
      ['projectTeams', `/projects/${orgId}/${projectId}/teams/`],
      ['allTeams', `/organizations/${orgId}/teams/`],
    ];
  }

  canCreateTeam = () => {
    const {organization} = this.props;
    const access = getOrganizationState(organization).getAccess();
    return (
      access.has('org:write') && access.has('team:write') && access.has('project:write')
    );
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

  handleAdd = selection => {
    if (this.state.loading) return;

    const team = this.state.allTeams.find(tm => tm.id === selection.value);

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

    if (!this.canCreateTeam()) return;

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

  renderAddTeamToProject() {
    const projectTeams = new Set(this.state.projectTeams.map(team => team.slug));
    const canAddTeam = this.props.organization.access.includes('project:write');
    const canCreateTeam = this.canCreateTeam();
    let teamsToAdd;

    if (!this.state.allTeams) {
      teamsToAdd = [];
      Sentry.withScope(scope => {
        scope.setExtra('state', this.state);
        Sentry.captureException(new Error('This.state.allTeams is null'));
      });
    } else {
      teamsToAdd = this.state.allTeams
        .filter(team => {
          return team.hasAccess && !projectTeams.has(team.slug);
        })
        .map(team => ({
          value: team.id,
          searchKey: team.slug,
          label: <TeamDropdownElement>#{team.slug}</TeamDropdownElement>,
        }));
    }

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
      <DropdownAutoComplete
        items={teamsToAdd}
        onSelect={this.handleAdd}
        menuHeader={menuHeader}
        emptyMessage={t('No teams')}
        disabled={!canAddTeam}
      >
        {({isOpen, selectedItem}) => (
          <DropdownButton isOpen={isOpen} size="xsmall" disabled={!canAddTeam}>
            {tct('Add Team to [projectId]', {projectId: this.props.params.projectId})}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  }

  renderEmpty() {
    return (
      <EmptyMessage>{t('There are no teams with access to this project.')}</EmptyMessage>
    );
  }

  renderResults() {
    const {orgId, projectId} = this.props.params;
    const access = new Set(this.props.organization.access);

    return this.state.projectTeams.map(team => {
      return (
        <TeamRow
          access={access}
          key={team.id}
          orgId={orgId}
          projectId={projectId}
          team={team}
          onRemove={this.handleRemovedTeam.bind(this, team)}
          teamCount={this.state.projectTeams.length}
        />
      );
    });
  }

  renderBody() {
    const {params} = this.props;
    const body =
      this.state.projectTeams.length > 0 ? this.renderResults() : this.renderEmpty();

    return (
      <div>
        <SettingsPageHeader
          title={tct('[projectId] Teams', {projectId: params.projectId})}
        />
        <Panel>
          <PanelHeader hasButtons={true}>
            <div>{t('Team')}</div>
            <div>{this.renderAddTeamToProject()}</div>
          </PanelHeader>
          <PanelBody>{body}</PanelBody>
        </Panel>
      </div>
    );
  }
}

const TeamDropdownElement = styled('div')`
  padding: ${space(0.5)} ${space(0.25)};
  text-transform: none;
`;

const StyledTeamsLabel = styled('div')`
  width: 250px;
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
