import {Component, ComponentClass} from 'react';
import styled from '@emotion/styled';

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
};

type SelectionAction = {action: 'key' | 'unkey'};
type MyTeamSelection = SelectionAction & {type: 'my teams'};
type TeamIdSelection = SelectionAction & {type: 'id'; teamId: string};
type TeamSelection = MyTeamSelection | TeamIdSelection;

function isMyTeamSelection(selection: TeamSelection): selection is MyTeamSelection {
  return selection.type === 'my teams';
}

class TeamKeyTransaction extends Component<Props, State> {
  state: State = {
    isLoading: true,
    keyFetchID: undefined,
    error: null,
    keyedTeams: new Set(),
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
    const {api, organization, project, transactionName} = this.props;

    const url = `/organizations/${organization.slug}/key-transactions/`;
    const keyFetchID = Symbol('keyFetchID');

    this.setState({isLoading: true, keyFetchID});

    try {
      const [data] = await api.requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          project: String(project),
          transaction: transactionName,
        },
      });
      this.setState({
        isLoading: false,
        keyFetchID: undefined,
        error: null,
        keyedTeams: new Set(data.map(({team}) => team)),
      });
    } catch (err) {
      this.setState({
        isLoading: false,
        keyFetchID: undefined,
        error: err.responseJSON?.detail ?? null,
      });
    }
  }

  handleToggleKeyTransaction = async (selection: TeamSelection) => {
    // TODO: handle the max 100 limit
    const {api, organization, project, teams, transactionName} = this.props;
    const markAsKeyTransaction = selection.action === 'key';

    let teamIds;
    let keyedTeams;
    if (isMyTeamSelection(selection)) {
      teamIds = teams.map(({id}) => id);
      if (markAsKeyTransaction) {
        keyedTeams = new Set(teamIds);
      } else {
        keyedTeams = new Set();
      }
    } else {
      teamIds = [selection.teamId];
      keyedTeams = new Set(this.state.keyedTeams);
      if (markAsKeyTransaction) {
        keyedTeams.add(selection.teamId);
      } else {
        keyedTeams.delete(selection.teamId);
      }
    }

    try {
      await toggleKeyTransaction(
        api,
        !markAsKeyTransaction,
        organization.slug,
        [project],
        transactionName,
        teamIds
      );
      this.setState({
        isLoading: false,
        keyFetchID: undefined,
        error: null,
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

  render() {
    const {teams, title} = this.props;
    const {keyedTeams, isLoading} = this.state;

    if (isLoading) {
      const Title = title;
      return <Title disabled keyedTeamsCount={0} />;
    }

    return (
      <TeamKeyTransactionSelector
        title={title}
        handleToggleKeyTransaction={this.handleToggleKeyTransaction}
        teams={teams}
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
};

function TeamKeyTransactionSelector({
  title: Title,
  handleToggleKeyTransaction,
  teams,
  keyedTeams,
}: SelectorProps) {
  const toggleTeam = (team: TeamSelection) => e => {
    e.stopPropagation();
    handleToggleKeyTransaction(team);
  };

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
                <StyledCheckbox
                  isChecked={teams.length === keyedTeams.size}
                  isIndeterminate={teams.length > keyedTeams.size && keyedTeams.size > 0}
                  onClick={toggleTeam({
                    type: 'my teams',
                    action: teams.length === keyedTeams.size ? 'unkey' : 'key',
                  })}
                />
              </DropdownMenuHeader>
              {teams.map(team => (
                <DropdownMenuItem
                  key={team.slug}
                  onClick={toggleTeam({
                    type: 'id',
                    action: keyedTeams.has(team.id) ? 'unkey' : 'key',
                    teamId: team.id,
                  })}
                >
                  <MenuItemContent>
                    {team.name}
                    <StyledCheckbox isChecked={keyedTeams.has(team.id)} />
                  </MenuItemContent>
                </DropdownMenuItem>
              ))}
            </DropdownContent>
          )}
        </DropdownWrapper>
      )}
    </DropdownControl>
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

const StyledCheckbox = styled(CheckboxFancy)`
  min-width: ${space(2)};
  margin-left: ${space(1)};
`;

export default withApi(TeamKeyTransaction);
