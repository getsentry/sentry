import {Component} from 'react';
import styled from '@emotion/styled';

import {toggleKeyTransaction} from 'app/actionCreators/performance';
import {Client} from 'app/api';
import Button from 'app/components/button';
import TeamKeyTransaction, {
  TitleProps,
} from 'app/components/performance/teamKeyTransaction';
import {IconStar} from 'app/icons';
import {t, tn} from 'app/locale';
import {Organization, Team} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import withTeams from 'app/utils/withTeams';

/**
 * This can't be a function component because `TeamKeyTransaction` uses
 * `DropdownControl` which in turn uses passes a ref to this component.
 */
class TitleButton extends Component<TitleProps> {
  render() {
    const {keyedTeamsCount, ...props} = this.props;
    return (
      <StyledButton
        {...props}
        icon={keyedTeamsCount ? <IconStar color="yellow300" isSolid /> : <IconStar />}
      >
        {keyedTeamsCount
          ? tn('Starred for Team', 'Starred for Teams', keyedTeamsCount)
          : t('Star for Team')}
      </StyledButton>
    );
  }
}

type BaseProps = {
  api: Client;
  organization: Organization;
  transactionName: string;
  teams: Team[];
};

type Props = BaseProps & {
  project: number;
};

type State = {
  isLoading: boolean;
  keyFetchID: symbol | undefined;
  error: null | string;
  keyedTeams: Set<string>;
  counts: Map<string, number>;
};

class TeamKeyTransactionButton extends Component<Props, State> {
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

  handleToggleKeyTransaction = async (
    isKey: boolean,
    teamIds: string[],
    counts: Map<string, number>,
    keyedTeams: Set<string>
  ) => {
    const {api, organization, project, transactionName} = this.props;
    try {
      await toggleKeyTransaction(
        api,
        isKey,
        organization.slug,
        [project],
        transactionName,
        teamIds
      );
      this.setState({
        counts,
        keyedTeams,
      });
    } catch (err) {
      this.setState({
        error: err.responseJSON?.detail ?? null,
      });
    }
  };

  render() {
    const {isLoading, counts, keyedTeams} = this.state;
    return (
      <TeamKeyTransaction
        isLoading={isLoading}
        counts={counts}
        keyedTeams={keyedTeams}
        handleToggleKeyTransaction={this.handleToggleKeyTransaction}
        title={TitleButton}
        {...this.props}
      />
    );
  }
}

type WrapperProps = BaseProps & {
  eventView: EventView;
};

function TeamKeyTransactionButtonWrapper({eventView, teams, ...props}: WrapperProps) {
  if (eventView.project.length !== 1) {
    return <TitleButton disabled keyedTeamsCount={0} />;
  }

  const userTeams = teams.filter(({isMember}) => isMember);
  return (
    <TeamKeyTransactionButton
      teams={userTeams}
      project={eventView.project[0]}
      {...props}
    />
  );
}

const StyledButton = styled(Button)`
  width: 180px;
`;

export default withApi(withTeams(TeamKeyTransactionButtonWrapper));
