import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from '../../../locale';
import ApiMixin from '../../../mixins/apiMixin';
import AsyncView from '../../asyncView';
import Button from '../../../components/buttons/button';
import Confirm from '../../../components/confirm';
import DropdownAutoComplete from '../../../components/dropdownAutoComplete';
import DropdownButton from '../../../components/dropdownButton';
import EmptyMessage from '../components/emptyMessage';
import IndicatorStore from '../../../stores/indicatorStore';
import Link from '../../../components/link';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import PanelItem from '../components/panelItem';
import SettingsPageHeader from '../components/settingsPageHeader';

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

    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {orgId, projectId, team} = this.props;
    this.api.request(`/projects/${orgId}/${projectId}/teams/${team.slug}/`, {
      method: 'DELETE',
      success: (d, _, jqXHR) => {
        this.props.onRemove();
        IndicatorStore.remove(loadingIndicator);
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
        IndicatorStore.remove(loadingIndicator);
      },
    });
  },

  render() {
    let {team, access, orgId} = this.props;

    return (
      <PanelItem>
        <Box flex="1">
          <h5 style={{margin: '10px 0px'}}>
            {access.has('team:write') ? (
              <Link to={`/settings/organization/${orgId}/teams/${team.slug}`}>
                #{team.slug}
              </Link>
            ) : (
              `#${team.slug}`
            )}
          </h5>
        </Box>
        {this.props.access.has('project:write') && (
          <Box pl={2}>
            <Confirm
              message={
                this.props.teamCount === 1
                  ? t(
                      'This is the last team with access to this project. Removing it will mean ' +
                        'only owners and managers will be able to access the project pages. Are ' +
                        'you sure you want to remove this team?'
                    )
                  : t('Are you sure you want to remove this team?')
              }
              onConfirm={this.handleRemove}
              disabled={this.state.loading}
            >
              <Button>
                <span className="icon icon-trash" /> &nbsp;{t('Remove')}
              </Button>
            </Confirm>
          </Box>
        )}
      </PanelItem>
    );
  },
});

class ProjectTeams extends AsyncView {
  getEndpoints() {
    let {orgId, projectId} = this.props.params;
    return [
      ['projectTeams', `/projects/${orgId}/${projectId}/teams/`],
      ['allTeams', `/organizations/${orgId}/teams/`],
    ];
  }

  handleRemovedTeam(removedTeam) {
    this.setState(prevState => {
      return {
        projectTeams: this.state.projectTeams.filter(team => {
          return team.slug !== removedTeam.slug;
        }),
      };
    });
  }

  handleAddedTeam(team) {
    this.setState(prevState => {
      return {
        projectTeams: this.state.projectTeams.concat([team]),
      };
    });
  }

  handleAdd = selection => {
    if (this.state.loading) return;

    let team = this.state.allTeams.find(tm => tm.id === selection.value);

    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/teams/${team.slug}/`, {
      method: 'POST',
      success: (d, _, jqXHR) => {
        this.handleAddedTeam(team);
        IndicatorStore.remove(loadingIndicator);
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
        IndicatorStore.remove(loadingIndicator);
      },
    });
  };

  renderEmpty() {
    return (
      <EmptyMessage>{t('There are no teams with access to this project.')}</EmptyMessage>
    );
  }

  renderResults() {
    let {orgId, projectId} = this.props.params;
    let access = new Set(this.props.organization.access);

    return [
      <PanelHeader key={'header'}>{t('Team')}</PanelHeader>,
      <PanelBody key={'body'}>
        {this.state.projectTeams.map(team => {
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
        })}
      </PanelBody>,
    ];
  }

  renderBody() {
    let {orgId} = this.props.params;
    let body;

    if (this.state.projectTeams.length > 0) body = this.renderResults();
    else body = this.renderEmpty();

    let projectTeams = new Set(this.state.projectTeams.map(team => team.slug));
    let teamsToAdd = this.state.allTeams
      .filter(team => {
        return team.hasAccess && !projectTeams.has(team.slug);
      })
      .map(team => ({value: team.id, label: team.slug}));

    return (
      <div>
        <SettingsPageHeader
          title={t('Teams')}
          action={
            <DropdownAutoComplete
              items={teamsToAdd}
              onSelect={this.handleAdd}
              action={
                <Button
                  to={`/organizations/${orgId}/teams/new/`}
                  priority="primary"
                  size="small"
                >
                  {t('Create a new team')}
                </Button>
              }
            >
              {({isOpen, selectedItem}) => (
                <DropdownButton isOpen={isOpen}>
                  <span className="icon-plus" /> {t('Add Team')}
                </DropdownButton>
              )}
            </DropdownAutoComplete>
          }
        />
        <Panel>{body}</Panel>
      </div>
    );
  }
}

export default ProjectTeams;
