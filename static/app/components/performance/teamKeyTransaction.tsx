import {Component, ReactElement} from 'react';
import styled from '@emotion/styled';

import {toggleKeyTransaction} from 'app/actionCreators/performance';
import {Client} from 'app/api';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import DropdownLink from 'app/components/dropdownLink';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Team} from 'app/types';
import withApi from 'app/utils/withApi';

export type TitleProps = {
  keyedTeamsCount: number;
  disabled?: boolean;
};

type Props = {
  api: Client;
  project: number;
  organization: Organization;
  teams: Team[];
  transactionName: string;
  title: (props: TitleProps) => ReactElement;
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
    if (orgSlugChanged || projectsChanged) {
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
    const {teams, title: Title} = this.props;
    const {keyedTeams, isLoading} = this.state;

    if (isLoading) {
      return <Title disabled keyedTeamsCount={keyedTeams.size} />;
    }

    return (
      <TeamKeyTransactionSelector
        title={<Title keyedTeamsCount={keyedTeams.size} />}
        handleToggleKeyTransaction={this.handleToggleKeyTransaction}
        teams={teams}
        keyedTeams={keyedTeams}
      />
    );
  }
}

type SelectorProps = {
  title: React.ReactNode;
  handleToggleKeyTransaction: (selection: TeamSelection) => void;
  teams: Team[];
  keyedTeams: Set<string>;
};

function TeamKeyTransactionSelector({
  title,
  handleToggleKeyTransaction,
  teams,
  keyedTeams,
}: SelectorProps) {
  const toggleTeam = (team: TeamSelection) => e => {
    e.stopPropagation();
    handleToggleKeyTransaction(team);
  };

  return (
    <DropdownLink caret={false} title={title} anchorMiddle>
      <DropdownMenuHeader
        first
        onClick={toggleTeam({
          type: 'my teams',
          action: teams.length === keyedTeams.size ? 'unkey' : 'key',
        })}
      >
        {t('My Teams')}
        <StyledCheckbox
          isChecked={teams.length === keyedTeams.size}
          isIndeterminate={teams.length > keyedTeams.size && keyedTeams.size > 0}
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
          {team.name}
          <StyledCheckbox isChecked={keyedTeams.has(team.id)} />
        </DropdownMenuItem>
      ))}
    </DropdownLink>
  );
}

const DropdownMenuItemBase = styled('li')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
`;

const DropdownMenuHeader = styled(DropdownMenuItemBase)<{first?: boolean}>`
  background: ${p => p.theme.backgroundSecondary};
  ${p => p.first && 'border-radius: 2px'};
`;

const DropdownMenuItem = styled(DropdownMenuItemBase)`
  border-top: 1px solid ${p => p.theme.border};
`;

const StyledCheckbox = styled(CheckboxFancy)`
  min-width: ${space(2)};
  margin-left: ${space(1)};
`;

export default withApi(TeamKeyTransaction);
