import React from 'react';
import styled from '@emotion/styled';

import AppComponentCard from 'app/components/card';
// import theme from 'app/utils/theme';

type Prop = {
  columnSpan: 1 | 2 | 3; // Size of the card
  content?: React.ReactNode;
};

class Card extends React.Component<Prop> {
  render() {
    const {columnSpan} = this.props;

    return (
      <CardWrapper columnSpan={columnSpan}>{this.props.children || 'asd1'}</CardWrapper>
    );
  }
}

export default Card;

const CardWrapper = styled(AppComponentCard)<{columnSpan: number}>`
  min-height: 200px; /* Allow taller rows based on content */
  grid-column: auto / span ${p => p.columnSpan || 1};
`;
