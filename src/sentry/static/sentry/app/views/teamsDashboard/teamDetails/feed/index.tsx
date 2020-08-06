import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import LoadingIndicator from 'app/components/loadingIndicator';
import {openModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import {IconStack} from 'app/icons';
import space from 'app/styles/space';
import {Team, Project, Organization} from 'app/types';

import withLocalStorage, {InjectedLocalStorageProps} from '../../withLocalStorage';
import {TAB} from '../../utils';
import CardActivity from './cards/cardActivity';
import CardAlerts from './cards/cardAlerts';
import CardAddNew from './cards/cardAddNew';
import CardIssueList from './cards/cardIssueList';
import CardPerformance from './cards/cardPerformance';
import CardDiscover from './cards/cardDiscover';
import {CardData, Section, FeedData} from './types';
import {getDevData} from './utils';
import SectionEditModal, {modalCss} from './sectionEditModal';

const DEFAULT_STATE: FeedData = {
  cards: [],
  sections: [],
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
      const data = this.getTabData();

      // we need to wait for all the necessary data to finish loading,
      // so check all the necessary values before setting it
      // Set localStorage with dev data
      if (!isLocalStorageLoading && Object.keys(data).length === 0) {
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

  getTabData() {
    const {data, team} = this.props;
    return data?.[team.slug] ?? {};
  }

  getCardData(): CardData[] {
    const data = this.getTabData();
    const cards: CardData[] = [...data?.cards] ?? [];

    return cards;
  }

  getSections(): Section[] {
    const data = this.getTabData();
    const sections: Section[] = [...data?.sections] ?? [];

    return sections;
  }

  renderIssueList(cards) {
    const {team} = this.props;
    return (
      <div>
        <h3>{t('Issues List')}</h3>
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

  renderAlerts(cards) {
    const {team} = this.props;
    return (
      <div>
        <h3>{t('Alerts')}</h3>
        <Container>
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
        <h3>{`${t('Discover Queries')} (${cards.length})`}</h3>
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
        <h3>{`${t('Key Transactions')} (${cards.length})`}</h3>
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

  renderDebuggingCards() {
    return (
      <div>
        <h3>{t('Debugging Stuff')}</h3>
        <Container>
          <CardAddNew
            index={0}
            removeCard={this.removeCard}
            addCard={this.addCard}
            resetLs={this.resetLs}
            resetLsAll={this.props.resetLsAll}
          />
        </Container>
      </div>
    );
  }

  handleApply = (sections: Section[]): void => {
    const {team} = this.props;
    const data = this.getTabData();
    this.props.setLs(team.slug, {...data, sections});
  };

  handleEditSections = () => {
    const sections = this.getSections();
    openModal(
      modalProps => (
        <SectionEditModal
          sections={sections}
          onApply={this.handleApply}
          {...modalProps}
        />
      ),
      {modalCss}
    );
  };

  renderSection(section: Section, cards: CardData[]) {
    switch (section.kind) {
      case 'issueList':
        return this.renderIssueList(
          cards.filter(c => c.type === 'issueList' || c.type === 'activity')
        );
      case 'alerts':
        return this.renderAlerts(cards.filter(c => c.type === 'alerts'));
      case 'discover':
        return this.renderDiscoverCards(cards.filter(c => c.type === 'discover'));
      case 'keyTransactions':
        // naming is questionable here will fix if we get around to it
        return this.renderPerformanceCards(cards.filter(c => c.type === 'performance'));
      default:
        throw new Error('Unknown Section Kind');
    }
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
    const sections = this.getSections();

    return (
      <Content>
        <Header>
          <Button
            size="small"
            onClick={this.handleEditSections}
            icon={<IconStack size="xs" />}
          >
            Sections
          </Button>
        </Header>
        {sections.map(section => this.renderSection(section, cards))}
        {this.renderDebuggingCards()}
      </Content>
    );
  }
}

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

const Header = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

export default withLocalStorage(Dashboard, TAB.ALL_TEAMS);
