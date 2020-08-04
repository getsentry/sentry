import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import Card from './cards';
import CardAddNew from './cards/cardAddNew';

export type CardStructure = {
  columnSpan: 1 | 2 | 3;
  cardProps: any;
};

type Props = {};
type State = {
  cards: CardStructure[];
};

class Dashboard extends React.Component<Props, State> {
  state: State = {
    cards: [
      {
        columnSpan: 1,
        cardProps: {},
      },
      {
        columnSpan: 1,
        cardProps: {},
      },
      {
        columnSpan: 1,
        cardProps: {},
      },
      {
        columnSpan: 2,
        cardProps: {},
      },
      {
        columnSpan: 1,
        cardProps: {},
      },
      {
        columnSpan: 3,
        cardProps: {},
      },
      {
        columnSpan: 1,
        cardProps: {},
      },
      {
        columnSpan: 2,
        cardProps: {},
      },
    ],
  };
  render() {
    const {cards} = this.state;
    return (
      <Container>
        {cards.map((c, i) => (
          <Card key={i} columnSpan={c.columnSpan} />
        ))}
        {this.props.children}
        <CardAddNew />
      </Container>
    );
  }
}

export default Dashboard;

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(100px, 1fr));
  grid-gap: ${space(3)};
`;
