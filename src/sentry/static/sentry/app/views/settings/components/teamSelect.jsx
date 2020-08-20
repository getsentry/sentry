import PropTypes from 'prop-types';
import React from 'react';
import debounce from 'lodash/debounce';
import styled from '@emotion/styled';

import {DEFAULT_DEBOUNCE_DURATION, TEAMS_PER_PAGE} from 'app/constants';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {IconSubtract} from 'app/icons';
import {t} from 'app/locale';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import DropdownAutoComplete from 'app/components/dropdownAutoCompleteV2';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Link from 'app/components/links/link';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

class TeamSelect extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,

    /**
     * Should button be disabled
     */
    disabled: PropTypes.bool,

    /**
     * Teams that are already selected.
     */
    selectedTeams: PropTypes.array.isRequired,
    /**
     * callback when teams are added
     */
    onAddTeam: PropTypes.func.isRequired,
    /**
     * Callback when teams are removed
     */
    onRemoveTeam: PropTypes.func.isRequired,

    /**
     * Optional menu header.
     */
    menuHeader: PropTypes.element,

    /**
     * Message to display when the last team is removed
     * if empty no confirm will be displayed.
     */
    confirmLastTeamRemoveMessage: PropTypes.string,
  };

  state = {
    loading: true,
    teams: null,
  };

  componentDidMount() {
    this.fetchTeams();
  }

  fetchTeams = debounce(async query => {
    const {api, organization} = this.props;
    const teams = await api.requestPromise(`/organizations/${organization.slug}/teams/`, {
      query: {query, per_page: TEAMS_PER_PAGE},
    });
    this.setState({teams, loading: false});
  }, DEFAULT_DEBOUNCE_DURATION);

  handleQueryUpdate = event => {
    this.setState({loading: true});
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
    const isDisabled = disabled;

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
        busyItemsStillVisible={this.state.loading}
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
        <Button
          size="xsmall"
          icon={<IconSubtract isCircled size="xs" />}
          disabled={disabled}
        >
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
