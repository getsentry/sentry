import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import space from 'app/styles/space';
import {Team, Project, Organization} from 'app/types';

import withLocalStorage, {InjectedLocalStorageProps} from '../../withLocalStorage';
import {TAB} from '../../utils';
import Card from './cards';
import CardActivity from './cards/cardActivity';
import CardAlerts from './cards/cardAlerts';
import CardAddNew from './cards/cardAddNew';
import CardDiscover from './cards/cardDiscover';
import CardIssueList from './cards/cardIssueList';
import CardPerformance from './cards/cardPerformance';
import CardReleases from './cards/cardReleases';
import {CardData, FeedData} from './types';
import {getDevData} from './utils';

const DEFAULT_STATE: FeedData = {
  cards: [],
};

type Props = AsyncComponent['props'] &
  InjectedLocalStorageProps & {
    location: Location;
    data: FeedData;
    organization: Organization;
    team: Team;
    projects: Project[];
  };

type State = AsyncComponent['state'] & {
  keyTransactions: {
    data: {
      project: string;
      transaction: string;
      user_misery_300: string;
      apdex_300: string;
    }[];
  };
};

class Dashboard extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;

    const keyTransactionPayload = {
      query: {
        statsPeriod: '24h',
        field: ['transaction', 'project', 'project.id', 'apdex(300)', 'user_misery(300)'],
        sort: 'transaction',
        per_page: 50,
      },
    };

    return [
      [
        'keyTransactions',
        `/organizations/${organization.slug}/key-transactions/`,
        keyTransactionPayload,
      ],
    ];
  }

  componentDidUpdate(_, prevState: State) {
    if (this.state.loading !== prevState.loading && !this.state.loading) {
      const {team, projects, organization, isLocalStorageLoading} = this.props;
      const {keyTransactions} = this.state;
      const keyTransactionsData = keyTransactions?.data ?? [];

      // we need to wait for all the necessary data to finish loading,
      // so check all the necessary values before setting it
      // Set localStorage with dev data
      if (!isLocalStorageLoading) {
        this.props.setLs(
          team.slug,
          getDevData(projects, organization, keyTransactionsData)
        );
      }
    }
  }

  resetLs = () => {
    const {team} = this.props;
    this.props.resetLs(team.slug, DEFAULT_STATE);
  };

  addCard = (index: number, cardData: CardData) => {
    const {team} = this.props;
    const data = this.getTabData();
    const prevCards = data.cards;
    const nextCards = [...prevCards.slice(0, index), cardData, ...prevCards.slice(index)];

    this.props.setLs(team.slug, {...data, cards: nextCards});
  };

  removeCard = (index: number) => {
    const {team} = this.props;
    const data = this.getTabData();
    const prevCards = data.cards;
    const nextCards = [...prevCards.slice(0, index), ...prevCards.slice(index + 1)];

    this.props.setLs(team.slug, {...data, cards: nextCards});
  };

  getCardComponent(type): typeof React.Component {
    switch (type) {
      case 'activity':
        return CardActivity;
      case 'alerts':
        return CardAlerts;
      case 'discover':
        return CardDiscover;
      case 'issueList':
        return CardIssueList;
      case 'performance':
        return CardPerformance;
      default:
        return Card;
    }
  }

  getTabData() {
    const {data, team} = this.props;
    return data?.[team.slug] ?? {};
  }

  getCardData(): CardData[] {
    const data = this.getTabData();
    const cards: CardData[] = [...data?.cards] ?? [];

    return cards;
  }

  renderIssueList(cards) {
    const {team} = this.props;
    return (
      <div>
        <SectionTitle>{t('Issues List')}</SectionTitle>
        <Container>
          {cards.map(
            (c, i) =>
              c.type === 'issueList' && (
                <CardIssueList
                  key={c.key || c.data?.id || i.toString()}
                  index={i}
                  card={this.removeCard}
                  teamSlug={team.slug}
                  projects={this.props.projects}
                  {...c}
                />
              )
          )}
          {cards.map(
            (c, i) =>
              c.type === 'activity' && (
                <CardActivity
                  key={c.key || c.data?.id || i.toString()}
                  index={i}
                  card={this.removeCard}
                  {...c}
                />
              )
          )}
        </Container>
      </div>
    );
  }

  renderRelease(cards) {
    const {team} = this.props;
    return (
      <div>
        <SectionTitle>{t('Releases')}</SectionTitle>
        <Container>
          {cards.map(
            (c, i) =>
              c.type === 'releases' && (
                <CardReleases
                  key={c.key || c.data?.id || i.toString()}
                  index={i}
                  card={this.removeCard}
                  teamSlug={team.slug}
                  projects={this.props.projects}
                  {...c}
                />
              )
          )}
          {cards.map(
            (c, i) =>
              c.type === 'alerts' && (
                <CardAlerts
                  key={c.key || c.data?.id || i.toString()}
                  index={i}
                  card={this.removeCard}
                  teamSlug={team.slug}
                  projects={this.props.projects}
                  {...c}
                />
              )
          )}
        </Container>
      </div>
    );
  }

  renderDiscoverCards(cards) {
    const {location} = this.props;

    return (
      <div>
        <SectionTitle>{`${t('Discover Queries')} (${cards.length})`}</SectionTitle>
        <Container>
          {cards.map((c, i) => (
            <CardDiscover
              key={c.key || c.data?.id || i.toString()}
              index={i}
              card={this.removeCard}
              location={location}
              {...c}
            />
          ))}
        </Container>
      </div>
    );
  }

  renderPerformanceCards(cards) {
    return (
      <div>
        <SectionTitle>{`${t('Key Transactions')} (${cards.length})`}</SectionTitle>
        <Container>
          {cards.map((c, i) => (
            <CardPerformance
              key={c.key || c.data?.id || i.toString()}
              index={i}
              card={this.removeCard}
              {...c}
            />
          ))}
        </Container>
      </div>
    );
  }

  render() {
    const data = this.getTabData();

    if (Object.keys(data).length === 0) {
      return (
        <LoadingWrapper>
          <LoadingIndicator />
        </LoadingWrapper>
      );
    }

    const cards = this.getCardData();

    return (
      <Content>
        {this.renderIssueList(
          cards.filter(c => c.type === 'issueList' || c.type === 'activity')
        )}
        {this.renderRelease(
          cards.filter(c => c.type === 'releases' || c.type === 'alerts')
        )}
        {this.renderDiscoverCards(cards.filter(c => c.type === 'discover'))}
        {this.renderPerformanceCards(cards.filter(c => c.type === 'performance'))}
        <div>
          <SectionTitle>{t('Debugging Stuff')}</SectionTitle>
          <Container>
            <CardAddNew
              index={cards.length + 1}
              removeCard={this.removeCard}
              addCard={this.addCard}
              resetLs={this.resetLs}
              resetLsAll={this.props.resetLsAll}
            />
          </Container>
        </div>
      </Content>
    );
  }
}

export default withLocalStorage(Dashboard, TAB.ALL_TEAMS);

const Content = styled('div')`
  display: grid;
  grid-template-columns: repeat(1, minmax(100px, 1fr));
  grid-gap: ${space(3)};
`;

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(100px, 1fr));
  grid-gap: ${space(3)};
`;

const LoadingWrapper = styled('div')`
  flex: 1;
  display: flex;
  align-items: center;
`;

const SectionTitle = styled('div')`
  font-size: 18px;
  color: #7c6a8e;
  padding-bottom: 4px;
  font-family: 'Rubik', 'Avenir Next', 'Helvetica Neue', sans-serif;
`;
