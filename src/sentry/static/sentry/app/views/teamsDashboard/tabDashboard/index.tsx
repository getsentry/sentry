import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import withLocalStorage, {InjectedLocalStorageProps} from '../withLocalStorage';
import {TAB_DASHBOARD} from '../utils';
import Card from './cards';
import CardAddNew from './cards/cardAddNew';
import {CardData, DashboardData} from './types';
import {getDevData} from './utils';

const DEFAULT_STATE: DashboardData = {
  cards: [],
};

type Props = InjectedLocalStorageProps & {
  data: DashboardData;
};

class Dashboard extends React.Component<Props> {
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

  render() {
    const {data} = this.props;
    if (!data) {
      return <h3>LOADING!</h3>;
    }

    const cards: CardData[] = data.cards || [];

    return (
      <Container>
        {cards.map((c, i) => (
          <Card key={c.id || i} index={i} removeCard={this.removeCard} {...c} />
        ))}

        <CardAddNew
          index={cards.length}
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

export default withLocalStorage(Dashboard, TAB_DASHBOARD);

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(100px, 1fr));
  grid-gap: ${space(3)};
`;
