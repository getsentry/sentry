import {Component, createContext} from 'react';
import isEqual from 'lodash/isEqual';

import {
  fetchTeamKeyTransactions,
  TeamKeyTransactions,
  toggleKeyTransaction,
} from 'sentry/actionCreators/performance';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization, Project, Team} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

export type TeamSelection = {
  action: 'key' | 'unkey';
  project: Project;
  teamIds: string[];
  transactionName: string;
};

export type TeamKeyTransactionManagerChildrenProps = {
  counts: Map<string, number> | null;
  error: string | null;
  getKeyedTeams: (project: string, transactionName: string) => Set<string> | null;
  handleToggleKeyTransaction: (selection: TeamSelection) => void;
  isLoading: boolean;
  teams: Team[];
};

const TeamKeyTransactionsManagerContext =
  createContext<TeamKeyTransactionManagerChildrenProps>({
    teams: [],
    isLoading: false,
    error: null,
    counts: null,
    getKeyedTeams: () => null,
    handleToggleKeyTransaction: () => {},
  });

type Props = {
  api: Client;
  children: React.ReactNode;
  organization: Organization;
  selectedTeams: string[];
  teams: Team[];
  selectedProjects?: string[];
};

type State = Omit<
  TeamKeyTransactionManagerChildrenProps,
  'teams' | 'counts' | 'getKeyedTeams' | 'handleToggleKeyTransaction'
> & {
  keyFetchID: symbol | null;
  teamKeyTransactions: TeamKeyTransactions;
};

class UnwrappedProvider extends Component<Props> {
  state: State = {
    keyFetchID: null,
    isLoading: true,
    error: null,
    teamKeyTransactions: [],
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const orgSlugChanged = prevProps.organization.slug !== this.props.organization.slug;
    const selectedTeamsChanged = !isEqual(
      prevProps.selectedTeams,
      this.props.selectedTeams
    );
    const selectedProjectsChanged = !isEqual(
      prevProps.selectedProjects,
      this.props.selectedProjects
    );

    if (orgSlugChanged || selectedTeamsChanged || selectedProjectsChanged) {
      this.fetchData();
    }
  }

  async fetchData() {
    const {api, organization, selectedTeams, selectedProjects} = this.props;
    const keyFetchID = Symbol('keyFetchID');
    this.setState({isLoading: true, keyFetchID});

    let teamKeyTransactions: TeamKeyTransactions = [];
    let error: string | null = null;

    try {
      teamKeyTransactions = await fetchTeamKeyTransactions(
        api,
        organization.slug,
        selectedTeams,
        selectedProjects
      );
    } catch (err) {
      error = err.responseJSON?.detail ?? t('Error fetching team key transactions');
    }

    this.setState({
      isLoading: false,
      keyFetchID: undefined,
      error,
      teamKeyTransactions,
    });
  }

  getCounts() {
    const {teamKeyTransactions} = this.state;

    const counts: Map<string, number> = new Map();

    teamKeyTransactions.forEach(({team, count}) => {
      counts.set(team, count);
    });

    return counts;
  }

  getKeyedTeams = (projectId: string, transactionName: string) => {
    const {teamKeyTransactions} = this.state;

    const keyedTeams: Set<string> = new Set();

    teamKeyTransactions.forEach(({team, keyed}) => {
      const isKeyedByTeam = keyed.find(
        keyedTeam =>
          keyedTeam.project_id === projectId && keyedTeam.transaction === transactionName
      );
      if (isKeyedByTeam) {
        keyedTeams.add(team);
      }
    });

    return keyedTeams;
  };

  handleToggleKeyTransaction = async (selection: TeamSelection) => {
    const {api, organization} = this.props;
    const {teamKeyTransactions} = this.state;
    const {action, project, transactionName, teamIds} = selection;
    const isKeyTransaction = action === 'unkey';

    const teamIdSet = new Set(teamIds);

    const newTeamKeyTransactions = teamKeyTransactions.map(({team, count, keyed}) => {
      if (!teamIdSet.has(team)) {
        return {team, count, keyed};
      }

      if (isKeyTransaction) {
        return {
          team,
          count: count - 1,
          keyed: keyed.filter(
            keyTransaction =>
              keyTransaction.project_id !== project.id ||
              keyTransaction.transaction !== transactionName
          ),
        };
      }
      return {
        team,
        count: count + 1,
        keyed: [
          ...keyed,
          {
            project_id: project.id,
            transaction: transactionName,
          },
        ],
      };
    });

    try {
      await toggleKeyTransaction(
        api,
        isKeyTransaction,
        organization.slug,
        [project.id],
        transactionName,
        teamIds
      );
      this.setState({teamKeyTransactions: newTeamKeyTransactions});
    } catch (err) {
      this.setState({
        error: err.responseJSON?.detail ?? null,
      });
    }
  };

  render() {
    const {teams} = this.props;
    const {isLoading, error} = this.state;

    const childrenProps: TeamKeyTransactionManagerChildrenProps = {
      teams,
      isLoading,
      error,
      counts: this.getCounts(),
      getKeyedTeams: this.getKeyedTeams,
      handleToggleKeyTransaction: this.handleToggleKeyTransaction,
    };

    return (
      <TeamKeyTransactionsManagerContext.Provider value={childrenProps}>
        {this.props.children}
      </TeamKeyTransactionsManagerContext.Provider>
    );
  }
}

export const Provider = withApi(UnwrappedProvider);

export const Consumer = TeamKeyTransactionsManagerContext.Consumer;
