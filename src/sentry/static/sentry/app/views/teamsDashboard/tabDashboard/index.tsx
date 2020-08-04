import React from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import withLocalStorage, {InjectedLocalStorageProps} from '../withLocalStorage';
import {TAB_DASHBOARD} from '../utils';
import Card from './cards';
import CardAddNew from './cards/cardAddNew';
import CardIssueList from './cards/cardIssueList';
import CardPerformance from './cards/cardPerformance';
import {CardData, DashboardData} from './types';
import {getDevData} from './utils';

const DEFAULT_STATE: DashboardData = {
  cards: [],
};

type Props = AsyncComponent['props'] &
  InjectedLocalStorageProps & {
    data: DashboardData;
    organization: Organization;
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

  componentDidUpdate(prevProps) {
    if (prevProps === this.props) {
      return;
    }

    // Set localStorage with dev data
    if (!this.props.data) {
      this.props.setLs(getDevData());
    }
  }

  resetLs = () => {
    this.props.resetLs(DEFAULT_STATE);
  };

  addCard = (index: number, cardData: CardData) => {
    const {data} = this.props;
    const prevCards = data.cards;
    const nextCards = [...prevCards.slice(0, index), cardData, ...prevCards.slice(index)];

    this.props.setLs({...data, cards: nextCards});
  };

  removeCard = (index: number) => {
    const {data} = this.props;
    const prevCards = data.cards;
    const nextCards = [...prevCards.slice(0, index), ...prevCards.slice(index + 1)];

    this.props.setLs({...data, cards: nextCards});
  };

  getCardComponent(type) {
    switch (type) {
      case 'performance':
        return CardPerformance;
      case 'issueList':
        return CardIssueList;
      default:
        return Card;
    }
  }

  getCardData(): CardData[] {
    const {data} = this.props;
    const cards: CardData[] = [...data?.cards] ?? [];

    const {keyTransactions} = this.state;

    if (keyTransactions) {
      keyTransactions.data.forEach(row => {
        cards.push({
          type: 'performance',
          columnSpan: 1,
          data: {
            transaction: row.transaction,
            project: row.project,
            projectId: row['project.id'],
            apdex: row.apdex_300,
            userMisery: row.user_misery_300,
          },
        });
      });
    }

    return cards;
  }

  render() {
    const {data} = this.props;

    if (!data) {
      return <h3>LOADING!</h3>;
    }

    const cards = this.getCardData();

    return (
      <Container>
        {/* If your add/remove is behaving weirdly, it's due to i.toString() */}
        {cards.map((c, i) => {
          const Component = this.getCardComponent(c.type);
          return (
            <Component
              key={c.key || c.data?.id || i.toString()}
              index={i}
              removeCard={this.removeCard}
              {...c}
            />
          );
        })}

        <CardAddNew
          index={cards.length + 1}
          removeCard={this.removeCard}
          addCard={this.addCard}
          resetLs={this.resetLs}
          resetLsAll={this.props.resetLsAll}
        />

        {this.props.children}
      </Container>
    );
  }
}

export default withLocalStorage(withOrganization(Dashboard), TAB_DASHBOARD);

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(100px, 1fr));
  grid-gap: ${space(3)};
`;
