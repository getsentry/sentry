import {Component, ComponentClass} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {toggleKeyTransaction} from 'app/actionCreators/performance';
import {Client} from 'app/api';
import MenuHeader from 'app/components/actions/menuHeader';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import DropdownControl, {Content} from 'app/components/dropdownControl';
import {GetActorPropsFn} from 'app/components/dropdownMenu';
import MenuItem from 'app/components/menuItem';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Team} from 'app/types';
import {MAX_TEAM_KEY_TRANSACTIONS} from 'app/utils/performance/constants';
import withApi from 'app/utils/withApi';

export type TitleProps = Partial<ReturnType<GetActorPropsFn>> & {
  keyedTeamsCount: number;
  disabled?: boolean;
};

type Props = {
  api: Client;
  project: number;
  organization: Organization;
  teams: Team[];
  transactionName: string;
  title: ComponentClass<TitleProps>;
};

type State = {
  isLoading: boolean;
  keyFetchID: symbol | undefined;
  error: null | string;
  keyedTeams: Set<string>;
  counts: Map<string, number>;
};

type SelectionAction = {action: 'key' | 'unkey'};
type MyTeamSelection = SelectionAction & {type: 'my teams'};
type TeamIdSelection = SelectionAction & {type: 'id'; teamId: string};
type TeamSelection = MyTeamSelection | TeamIdSelection;

function isMyTeamSelection(selection: TeamSelection): selection is MyTeamSelection {
  return selection.type === 'my teams';
}

function canKeyForTeam(team: Team, keyedTeams: Set<string>, counts: Map<string, number>) {
  const isChecked = keyedTeams.has(team.id);
  if (isChecked) {
    return true;
  }
  return (counts.get(team.id) ?? 0) < 1;
}

class TeamKeyTransaction extends Component<Props, State> {
  state: State = {
    isLoading: true,
    keyFetchID: undefined,
    error: null,
    keyedTeams: new Set(),
    counts: new Map(),
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const orgSlugChanged = prevProps.organization.slug !== this.props.organization.slug;
    const projectsChanged = prevProps.project !== this.props.project;
    const transactionChanged = prevProps.transactionName !== this.props.transactionName;
    if (orgSlugChanged || projectsChanged || transactionChanged) {
      this.fetchData();
    }
  }

  async fetchData() {
    const keyFetchID = Symbol('keyFetchID');
    this.setState({isLoading: true, keyFetchID});

    try {
      const [keyTransactions, counts] = await Promise.all([
        this.fetchKeyTransactionsData(),
        this.fetchCountData(),
      ]);
      this.setState({
        isLoading: false,
        keyFetchID: undefined,
        error: null,
        keyedTeams: new Set(keyTransactions.map(({team}) => team)),
        counts: new Map(counts.map(({team, count}) => [team, count])),
      });
    } catch (err) {
      this.setState({
        isLoading: false,
        keyFetchID: undefined,
        error: err.responseJSON?.detail ?? null,
      });
    }
  }

  async fetchKeyTransactionsData() {
    const {api, organization, project, transactionName} = this.props;

    const url = `/organizations/${organization.slug}/key-transactions/`;
    const [data] = await api.requestPromise(url, {
      method: 'GET',
      includeAllArgs: true,
      query: {
        project: String(project),
        transaction: transactionName,
      },
    });
    return data;
  }

  async fetchCountData() {
    const {api, organization, teams} = this.props;

    const url = `/organizations/${organization.slug}/key-transactions-count/`;
    const [data] = await api.requestPromise(url, {
      method: 'GET',
      includeAllArgs: true,
      query: {team: teams.map(({id}) => id)},
    });
    return data;
  }

  handleToggleKeyTransaction = async (selection: TeamSelection) => {
    const {api, organization, project, transactionName} = this.props;
    const {teamIds, counts, keyedTeams} = isMyTeamSelection(selection)
      ? this.toggleMyTeams(selection)
      : this.toggleTeamId(selection);

    try {
      await toggleKeyTransaction(
        api,
        selection.action === 'unkey',
        organization.slug,
        [project],
        transactionName,
        teamIds
      );
      this.setState({
        isLoading: false,
        keyFetchID: undefined,
        error: null,
        counts,
        keyedTeams,
      });
    } catch (err) {
      this.setState({
        isLoading: false,
        keyFetchID: undefined,
        error: err.responseJSON?.detail ?? null,
      });
    }
  };

  toggleMyTeams(selection: MyTeamSelection) {
    const {teams} = this.props;
    const {counts, keyedTeams} = this.state;

    const markAsKey = selection.action === 'key';

    const teamIds = markAsKey
      ? teams
          .filter(team => !keyedTeams.has(team.id))
          .filter(team => canKeyForTeam(team, keyedTeams, counts))
          .map(({id}) => id)
      : teams.filter(team => keyedTeams.has(team.id)).map(({id}) => id);

    return this.toggleTeamIds(selection, teamIds);
  }

  toggleTeamId(selection: TeamIdSelection) {
    const teamId = selection.teamId;
    return this.toggleTeamIds(selection, [teamId]);
  }

  toggleTeamIds(selection: TeamSelection, teamIds: string[]) {
    const {counts, keyedTeams} = this.state;

    const markAsKey = selection.action === 'key';

    const newCounts = new Map(counts);
    const newKeyedTeams = new Set(keyedTeams);

    if (markAsKey) {
      teamIds.forEach(teamId => {
        const currentCount = counts.get(teamId) || 0;
        newCounts.set(teamId, currentCount + 1);
        newKeyedTeams.add(teamId);
      });
    } else {
      teamIds.forEach(teamId => {
        const currentCount = counts.get(teamId) || 0;
        newCounts.set(teamId, currentCount - 1);
        newKeyedTeams.delete(teamId);
      });
    }

    return {
      teamIds,
      counts: newCounts,
      keyedTeams: newKeyedTeams,
    };
  }

  render() {
    const {teams, title} = this.props;
    const {counts, keyedTeams, isLoading} = this.state;

    if (isLoading) {
      const Title = title;
      return <Title disabled keyedTeamsCount={0} />;
    }

    return (
      <TeamKeyTransactionSelector
        title={title}
        handleToggleKeyTransaction={this.handleToggleKeyTransaction}
        teams={teams}
        counts={counts}
        keyedTeams={keyedTeams}
      />
    );
  }
}

type SelectorProps = {
  title: ComponentClass<TitleProps>;
  handleToggleKeyTransaction: (selection: TeamSelection) => void;
  teams: Team[];
  keyedTeams: Set<string>;
  counts: Map<string, number>;
};

function TeamKeyTransactionSelector({
  title: Title,
  handleToggleKeyTransaction,
  teams,
  counts,
  keyedTeams,
}: SelectorProps) {
  const toggleTeam = (team: TeamSelection) => () => {
    handleToggleKeyTransaction(team);
  };

  const [enabledTeams, disabledTeams] = partition(teams, team =>
    canKeyForTeam(team, keyedTeams, counts)
  );

  const isMyTeamsEnabled = enabledTeams.length > 0;
  const myTeamsHandler = isMyTeamsEnabled
    ? toggleTeam({
        type: 'my teams',
        action: enabledTeams.length === keyedTeams.size ? 'unkey' : 'key',
      })
    : undefined;

  return (
    <DropdownControl
      button={({getActorProps}) => (
        <Title keyedTeamsCount={keyedTeams.size} {...getActorProps()} />
      )}
    >
      {({isOpen, getMenuProps}) => (
        <DropdownWrapper
          {...getMenuProps()}
          isOpen={isOpen}
          blendCorner
          alignMenu="right"
          width="220px"
        >
          {isOpen && (
            <DropdownContent>
              <DropdownMenuHeader first>
                {t('My Teams')}
                <ActionItem>
                  <CheckboxFancy
                    isDisabled={!isMyTeamsEnabled}
                    isChecked={teams.length === keyedTeams.size}
                    isIndeterminate={
                      teams.length > keyedTeams.size && keyedTeams.size > 0
                    }
                    onClick={myTeamsHandler}
                  />
                </ActionItem>
              </DropdownMenuHeader>
              {enabledTeams.map(team => (
                <TeamKeyTransactionItem
                  key={team.slug}
                  team={team}
                  isKeyed={keyedTeams.has(team.id)}
                  disabled={false}
                  onSelect={toggleTeam({
                    type: 'id',
                    action: keyedTeams.has(team.id) ? 'unkey' : 'key',
                    teamId: team.id,
                  })}
                />
              ))}
              {disabledTeams.map(team => (
                <TeamKeyTransactionItem
                  key={team.slug}
                  team={team}
                  isKeyed={keyedTeams.has(team.id)}
                  disabled
                  onSelect={toggleTeam({
                    type: 'id',
                    action: keyedTeams.has(team.id) ? 'unkey' : 'key',
                    teamId: team.id,
                  })}
                />
              ))}
            </DropdownContent>
          )}
        </DropdownWrapper>
      )}
    </DropdownControl>
  );
}

type ItemProps = {
  team: Team;
  isKeyed: boolean;
  disabled: boolean;
  onSelect: () => void;
};

function TeamKeyTransactionItem({team, isKeyed, disabled, onSelect}: ItemProps) {
  return (
    <DropdownMenuItem
      key={team.slug}
      disabled={disabled}
      onSelect={onSelect}
      stopPropagation
    >
      <MenuItemContent>
        {team.name}
        <ActionItem>
          {disabled ? (
            t('Max.%s', MAX_TEAM_KEY_TRANSACTIONS)
          ) : (
            <CheckboxFancy isChecked={isKeyed} />
          )}
        </ActionItem>
      </MenuItemContent>
    </DropdownMenuItem>
  );
}

const DropdownWrapper = styled(Content)`
  margin-top: 9px;
  left: auto;
  right: 50%;
  transform: translateX(calc(50%));

  /* Adapted from the dropdown-menu class */
  border: none;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(52, 60, 69, 0.2), 0 1px 3px rgba(70, 82, 98, 0.25);
  background-clip: padding-box;
  overflow: visible;

  &:before {
    width: 0;
    height: 0;
    border-left: 9px solid transparent;
    border-right: 9px solid transparent;
    border-bottom: 9px solid ${p => p.theme.border};
    content: '';
    display: block;
    position: absolute;
    top: -9px;
    left: calc(50% - 9px);
    right: auto;
    z-index: -2;
  }

  &:after {
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid ${p => p.theme.background};
    content: '';
    display: block;
    position: absolute;
    top: -8px;
    left: calc(50% - 8px);
    right: auto;
    z-index: -1;
  }
`;

const DropdownContent = styled('div')`
  max-height: 250px;
  overflow-y: auto;
`;

const DropdownMenuHeader = styled(MenuHeader)<{first?: boolean}>`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1.5)} ${space(2)};

  background: ${p => p.theme.backgroundSecondary};
  ${p => p.first && 'border-radius: 2px'};
`;

const DropdownMenuItem = styled(MenuItem)`
  font-size: ${p => p.theme.fontSizeMedium};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const MenuItemContent = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const ActionItem = styled('span')`
  min-width: ${space(2)};
  margin-left: ${space(1)};
`;

export default withApi(TeamKeyTransaction);
