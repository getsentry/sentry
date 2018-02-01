import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from '../../../locale';
import ApiMixin from '../../../mixins/apiMixin';
import AsyncView from '../../asyncView';
import Button from '../../../components/buttons/button';
import Confirm from '../../../components/confirm';
import DropdownLink from '../../../components/dropdownLink';
import EmptyMessage from '../components/emptyMessage';
import IndicatorStore from '../../../stores/indicatorStore';
import MenuItem from '../../../components/menuItem';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import Row from '../components/row';
import SettingsPageHeader from '../components/settingsPageHeader';

const TeamRow = createReactClass({
  displayName: 'TeamRow',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    team: PropTypes.object.isRequired,
    access: PropTypes.object.isRequired,
    onRemove: PropTypes.func.isRequired,
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
    let team = this.props.team;
    return (
      <Row p={2}>
        <Box flex="1">
          <h5 style={{margin: '10px 0px'}}>{team.name}</h5>
        </Box>
        {this.props.access.has('project:write') && (
          <Box pl={2}>
            <Confirm
              message={t('Are you sure you want to remove this team?')}
              onConfirm={this.handleRemove}
              disabled={this.state.loading}
            >
              <Button>
                <span className="icon icon-trash" /> &nbsp;{t('Remove')}
              </Button>
            </Confirm>
          </Box>
        )}
      </Row>
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

  handleAdd(team) {
    if (this.state.loading) return;

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
  }

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
    let teamsToAdd = this.state.allTeams.filter(team => {
      return team.hasAccess && !projectTeams.has(team.slug);
    });

    return (
      <div>
        <SettingsPageHeader
          title={t('Teams')}
          action={
            <DropdownLink
              anchorRight
              className="btn btn-primary btn-sm"
              title={t('Add Team')}
            >
              {teamsToAdd.length ? (
                teamsToAdd.map(team => {
                  return (
                    <MenuItem noAnchor={true} key={team.slug}>
                      <a onClick={this.handleAdd.bind(this, team)}>{team.name}</a>
                    </MenuItem>
                  );
                })
              ) : (
                <MenuItem noAnchor={true} key={'empty'}>
                  <a>{t('No available teams')}</a>
                </MenuItem>
              )}
              <MenuItem divider={true} />
              <div style={{textAlign: 'center', padding: '5px 0px'}}>
                <Button
                  to={`/organizations/${orgId}/teams/new/`}
                  priority="primary"
                  size="small"
                >
                  {t('Create a new team')}
                </Button>
              </div>
            </DropdownLink>
          }
        />
        <Panel>{body}</Panel>
      </div>
    );
  }
}

export default ProjectTeams;
