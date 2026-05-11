import {createContext, useCallback, useEffect, useState} from 'react';

import type {TeamKeyTransactions} from 'sentry/actionCreators/performance';
import {
  fetchTeamKeyTransactions,
  toggleKeyTransaction,
} from 'sentry/actionCreators/performance';
import {t} from 'sentry/locale';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApi} from 'sentry/utils/useApi';

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
  keyFetchID: symbol | null | undefined;
  teamKeyTransactions: TeamKeyTransactions;
};

const initialState = {
  keyFetchID: null,
  isLoading: true,
  error: null,
  teamKeyTransactions: [],
};

export function Provider({
  children,
  organization,
  selectedProjects,
  selectedTeams,
  teams,
}: Props) {
  const api = useApi();

  const [state, setState] = useState<State>(initialState);
  const refetchKey = JSON.stringify({selectedTeams, selectedProjects});

  const fetchData = useCallback(async () => {
    const keyFetchID = Symbol('keyFetchID');

    setState(previousState => ({...previousState, isLoading: true, keyFetchID}));

    let teamKeyTransactions: TeamKeyTransactions = [];
    let error: string | null = null;

    try {
      teamKeyTransactions = await fetchTeamKeyTransactions(
        api,
        organization.slug,
        selectedTeams,
        selectedProjects
      );
    } catch (err: any) {
      error = err.responseJSON?.detail ?? t('Error fetching team key transactions');
    }

    setState({
      isLoading: false,
      keyFetchID: undefined,
      error,
      teamKeyTransactions,
    });
    // This component receives referentially new selectedTeams and selectedProjects
    // on many renders. Ideally fetchTeamKeyTransactions should be refactored to use
    // `useApiQuery` or `useMutation` with `fetchDataQuery` and `fetchMutation`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, organization.slug, refetchKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function getCounts(teamKeyTransactions: TeamKeyTransactions) {
    const counts = new Map<string, number>();

    teamKeyTransactions.forEach(({team, count}) => {
      counts.set(team, count);
    });

    return counts;
  }

  const getKeyedTeams = useCallback(
    (projectId: string, transactionName: string) => {
      const keyedTeams = new Set<string>();

      state.teamKeyTransactions.forEach(({team, keyed}) => {
        const isKeyedByTeam = keyed.find(
          keyedTeam =>
            keyedTeam.project_id === projectId &&
            keyedTeam.transaction === transactionName
        );
        if (isKeyedByTeam) {
          keyedTeams.add(team);
        }
      });

      return keyedTeams;
    },
    [state.teamKeyTransactions]
  );

  const handleToggleKeyTransaction = useCallback(
    async (selection: TeamSelection) => {
      const {teamKeyTransactions} = state;
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
        setState(previousState => ({
          ...previousState,
          teamKeyTransactions: newTeamKeyTransactions,
        }));
      } catch (err: any) {
        setState(previousState => ({
          ...previousState,
          error: err.responseJSON?.detail ?? null,
        }));
      }
    },
    [api, organization.slug, state]
  );

  const childrenProps: TeamKeyTransactionManagerChildrenProps = {
    teams,
    isLoading: state.isLoading,
    error: state.error,
    counts: getCounts(state.teamKeyTransactions),
    getKeyedTeams,
    handleToggleKeyTransaction,
  };

  return (
    <TeamKeyTransactionsManagerContext value={childrenProps}>
      {children}
    </TeamKeyTransactionsManagerContext>
  );
}

export const Consumer = TeamKeyTransactionsManagerContext.Consumer;
