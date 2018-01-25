import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from '../../../locale';
import ApiMixin from '../../../mixins/apiMixin';
import AsyncView from '../../asyncView';
import Button from '../../../components/buttons/button';
import Confirm from '../../../components/confirm';
import EmptyMessage from '../components/emptyMessage';
import IndicatorStore from '../../../stores/indicatorStore';
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
    return [['teams', `/projects/${orgId}/${projectId}/teams/`]];
  }

  handleRemovedTeam(removedTeam) {
    this.setState({
      teams: this.state.teams.filter(team => {
        return team.slug !== removedTeam.slug;
      }),
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
      <PanelHeader key={'header'}>
        <Flex align="center">
          <Box px={2} flex="1">
            {t('Team')}
          </Box>
        </Flex>
      </PanelHeader>,
      <PanelBody key={'body'}>
        {this.state.teams.map(team => {
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
    let body;

    if (this.state.teams.length > 0) body = this.renderResults();
    else body = this.renderEmpty();

    return (
      <div>
        <SettingsPageHeader title={t('Teams')} />
        <Panel>{body}</Panel>
      </div>
    );
  }
}

export default ProjectTeams;
