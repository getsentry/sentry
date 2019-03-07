import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Box} from 'grid-emotion';
import {t} from 'app/locale';
import Button from 'app/components/button';
import SentryTypes from 'app/sentryTypes';
import Link from 'app/components/link';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

class TeamSelect extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    disabled: PropTypes.bool,
    selectedTeams: PropTypes.array.isRequired,
    onAddTeam: PropTypes.func.isRequired,
    onRemoveTeam: PropTypes.func.isRequired,
  };

  state = {
    teams: null,
  };

  componentDidMount() {
    this.fetchTeams();
  }

  fetchTeams(query) {
    const {organization} = this.props;
    this.props.api
      .requestPromise(`/organizations/${organization.slug}/teams/`, {
        query,
      })
      .then(teams => this.setState({teams}));
  }

  handleQueryUpdate = event => {
    this.fetchTeams(event.target.value);
  };

  handleAddTeam = option => {
    this.props.onAddTeam(option.value);
  };

  handleRemove = value => {
    this.props.onRemoveTeam(value);
  };

  renderTeamAddDropDown() {
    const {disabled, selectedTeams} = this.props;
    const {teams} = this.state;
    const noTeams = teams === null || teams.length === 0;
    const isDisabled = noTeams || disabled;

    let options;
    if (noTeams) {
      options = [];
    } else {
      options = teams
        .filter(team => {
          return !selectedTeams.includes(team.slug);
        })
        .map(team => ({
          value: team.slug,
          searchKey: team.slug,
          label: <TeamDropdownElement>#{team.slug}</TeamDropdownElement>,
        }));
    }

    return (
      <DropdownAutoComplete
        items={options}
        onChange={this.handleQueryUpdate}
        onSelect={this.handleAddTeam}
        emptyMessage={t('No teams')}
        disabled={isDisabled}
      >
        {({isOpen}) => (
          <DropdownButton isOpen={isOpen} size="xsmall" disabled={isDisabled}>
            {t('Add Team')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  }

  renderBody() {
    const {organization, selectedTeams, disabled} = this.props;
    if (selectedTeams.length === 0) {
      return <EmptyMessage>{t('No Teams assigned')}</EmptyMessage>;
    }

    return selectedTeams.map(team => {
      return (
        <TeamRow
          key={team}
          orgId={organization.slug}
          team={team}
          onRemove={this.handleRemove}
          disabled={disabled}
        />
      );
    });
  }

  render() {
    return (
      <Panel>
        <PanelHeader hasButtons={true}>
          {t('Team')}
          {this.renderTeamAddDropDown()}
        </PanelHeader>

        <PanelBody>{this.renderBody()}</PanelBody>
      </Panel>
    );
  }
}

const TeamRow = props => {
  const {orgId, team, onRemove, disabled} = props;
  return (
    <PanelItem p={2} align="center">
      <Box flex={1}>
        <Link to={`/settings/${orgId}/teams/${team}/`}>#{team}</Link>
      </Box>
      <Button
        size="xsmall"
        icon="icon-circle-subtract"
        onClick={() => onRemove(team)}
        disabled={disabled}
      >
        {t('Remove')}
      </Button>
    </PanelItem>
  );
};

TeamRow.propTypes = {
  disabled: PropTypes.bool,
  team: PropTypes.string.isRequired,
  orgId: PropTypes.string.isRequired,
  onRemove: PropTypes.func.isRequired,
};

const TeamDropdownElement = styled.div`
  padding: ${space(0.5)} ${space(0.25)};
  text-transform: none;
`;

export default withApi(TeamSelect);
