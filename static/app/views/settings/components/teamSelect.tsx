import * as React from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Client} from 'app/api';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import {Item} from 'app/components/dropdownAutoComplete/types';
import DropdownButton from 'app/components/dropdownButton';
import TeamBadge from 'app/components/idBadge/teamBadge';
import Link from 'app/components/links/link';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {DEFAULT_DEBOUNCE_DURATION, TEAMS_PER_PAGE} from 'app/constants';
import {IconSubtract} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Team} from 'app/types';
import withApi from 'app/utils/withApi';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

type Props = {
  api: Client;
  organization: Organization;
  /**
   * Should button be disabled
   */
  disabled: boolean;
  /**
   * Teams that are already selected.
   */
  selectedTeams: Team[];
  /**
   * callback when teams are added
   */
  onAddTeam: (team: Team) => void;
  /**
   * Callback when teams are removed
   */
  onRemoveTeam: (teamSlug: string) => void;

  /**
   * Optional menu header.
   */
  menuHeader?: React.ReactElement;

  /**
   * Message to display when the last team is removed
   * if empty no confirm will be displayed.
   */
  confirmLastTeamRemoveMessage?: string;
};

type State = {
  loading: boolean;
  teamsSearch: null | Team[];
};

class TeamSelect extends React.Component<Props, State> {
  state: State = {
    loading: true,
    teamsSearch: null,
  };

  componentDidMount() {
    this.fetchTeams();
  }

  fetchTeams = debounce(async (query?: string) => {
    const {api, organization} = this.props;
    const teamsSearch = await api.requestPromise(
      `/organizations/${organization.slug}/teams/`,
      {
        query: {query, per_page: TEAMS_PER_PAGE},
      }
    );
    this.setState({teamsSearch, loading: false});
  }, DEFAULT_DEBOUNCE_DURATION);

  handleQueryUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({loading: true});
    this.fetchTeams(event.target.value);
  };

  handleAddTeam = (option: Item) => {
    const team = this.state.teamsSearch?.find(tm => tm.slug === option.value);
    if (team) {
      this.props.onAddTeam(team);
    }
  };

  handleRemove = (teamSlug: string) => {
    this.props.onRemoveTeam(teamSlug);
  };

  renderTeamAddDropDown() {
    const {disabled, selectedTeams, menuHeader} = this.props;
    const {teamsSearch} = this.state;
    const isDisabled = disabled;

    let options: Item[] = [];
    if (teamsSearch === null || teamsSearch.length === 0) {
      options = [];
    } else {
      options = teamsSearch
        .filter(
          team => !selectedTeams.some(selectedTeam => selectedTeam.slug === team.slug)
        )
        .map((team, index) => ({
          index,
          value: team.slug,
          searchKey: team.slug,
          label: <DropdownTeamBadge avatarSize={18} team={team} />,
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
        alignMenu="right"
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
    const {organization, selectedTeams, disabled, confirmLastTeamRemoveMessage} =
      this.props;

    if (selectedTeams.length === 0) {
      return <EmptyMessage>{t('No Teams assigned')}</EmptyMessage>;
    }
    const confirmMessage =
      selectedTeams.length === 1 && confirmLastTeamRemoveMessage
        ? confirmLastTeamRemoveMessage
        : null;

    return selectedTeams.map(team => (
      <TeamRow
        key={team.slug}
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

type TeamRowProps = {
  orgId: string;
  team: Team;
  onRemove: Props['onRemoveTeam'];
  disabled: boolean;
  confirmMessage: string | null;
};

const TeamRow = ({orgId, team, onRemove, disabled, confirmMessage}: TeamRowProps) => (
  <TeamPanelItem>
    <StyledLink to={`/settings/${orgId}/teams/${team.slug}/`}>
      <TeamBadge team={team} />
    </StyledLink>
    <Confirm
      message={confirmMessage}
      bypass={!confirmMessage}
      onConfirm={() => onRemove(team.slug)}
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

const DropdownTeamBadge = styled(TeamBadge)`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
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
