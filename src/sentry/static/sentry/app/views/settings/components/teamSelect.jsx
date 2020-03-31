import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {t} from 'app/locale';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import SentryTypes from 'app/sentryTypes';
import Link from 'app/components/links/link';
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
    // Teams that are already selected.
    selectedTeams: PropTypes.array.isRequired,
    // callback when teams are added
    onAddTeam: PropTypes.func.isRequired,
    // Callback when teams are removed
    onRemoveTeam: PropTypes.func.isRequired,

    // Optional menu header.
    menuHeader: PropTypes.element,

    // Message to display when the last team is removed
    // if empty no confirm will be displayed.
    confirmLastTeamRemoveMessage: PropTypes.string,
  };

  state = {
    teams: null,
  };

  componentDidMount() {
    this.fetchTeams();
  }

  fetchTeams = debounce(query => {
    const {organization} = this.props;
    this.props.api
      .requestPromise(`/organizations/${organization.slug}/teams/`, {
        query: {query},
      })
      .then(teams => this.setState({teams}));
  }, 100);

  handleQueryUpdate = event => {
    this.fetchTeams(event.target.value);
  };

  handleAddTeam = option => {
    const team = this.state.teams.find(tm => tm.slug === option.value);
    this.props.onAddTeam(team);
  };

  handleRemove = teamSlug => {
    this.props.onRemoveTeam(teamSlug);
  };

  renderTeamAddDropDown() {
    const {disabled, selectedTeams, menuHeader} = this.props;
    const {teams} = this.state;
    const noTeams = teams === null || teams.length === 0;
    const isDisabled = noTeams || disabled;

    let options;
    if (noTeams) {
      options = [];
    } else {
      options = teams
        .filter(team => !selectedTeams.includes(team.slug))
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
        menuHeader={menuHeader}
        disabled={isDisabled}
      >
        {({isOpen}) => (
          <DropdownButton
            aria-label={t('Add Team')}
            isOpen={isOpen}
            size="xsmall"
            disabled={isDisabled}
          >
            {t('Add Team')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  }

  renderBody() {
    const {
      organization,
      selectedTeams,
      disabled,
      confirmLastTeamRemoveMessage,
    } = this.props;

    if (selectedTeams.length === 0) {
      return <EmptyMessage>{t('No Teams assigned')}</EmptyMessage>;
    }
    const confirmMessage =
      selectedTeams.length === 1 && confirmLastTeamRemoveMessage
        ? confirmLastTeamRemoveMessage
        : null;

    return selectedTeams.map(team => (
      <TeamRow
        key={team}
        orgId={organization.slug}
        team={team}
        onRemove={this.handleRemove}
        disabled={disabled}
        confirmMessage={confirmMessage}
      />
    ));
  }

  render() {
    return (
      <Panel>
        <PanelHeader hasButtons>
          {t('Team')}
          {this.renderTeamAddDropDown()}
        </PanelHeader>

        <PanelBody>{this.renderBody()}</PanelBody>
      </Panel>
    );
  }
}

const TeamRow = props => {
  const {orgId, team, onRemove, disabled, confirmMessage} = props;
  return (
    <TeamPanelItem>
      <StyledLink to={`/settings/${orgId}/teams/${team}/`}>{`#${team}`}</StyledLink>
      <Confirm
        message={confirmMessage}
        bypass={!confirmMessage}
        onConfirm={() => onRemove(team)}
        disabled={disabled}
      >
        <Button size="xsmall" icon="icon-circle-subtract" disabled={disabled}>
          {t('Remove')}
        </Button>
      </Confirm>
    </TeamPanelItem>
  );
};

TeamRow.propTypes = {
  disabled: PropTypes.bool,
  team: PropTypes.string.isRequired,
  orgId: PropTypes.string.isRequired,
  onRemove: PropTypes.func.isRequired,
  confirmMessage: PropTypes.string,
};

const TeamDropdownElement = styled('div')`
  padding: ${space(0.5)} ${space(0.25)};
  text-transform: none;
`;

const TeamPanelItem = styled(PanelItem)`
  padding: ${space(2)};
  align-items: center;
`;

const StyledLink = styled(Link)`
  flex: 1;
  margin-right: ${space(1)};
`;

export default withApi(TeamSelect);
