import React from 'react';
import styled from '@emotion/styled';

import AppComponentCard from 'app/components/card';
// import theme from 'app/utils/theme';

import {CardData} from '../types';

type Props = {
  // Related to Dashboard
  index: number;

  // Related to state changes
  removeCard: (index: number) => void;
  isRemovable?: boolean;
} & CardData;

class Card extends React.Component<Props> {
  removeCard = () => {
    const {index, removeCard: remove} = this.props;
    remove(index);
  };

  render() {
    const {columnSpan, isRemovable = true, data} = this.props;

    return (
      <CardWrapper columnSpan={columnSpan}>
        {this.props.children || `ID: ${data.id}`}
        {isRemovable && <div onClick={this.removeCard}>[remove card]</div>}
      </CardWrapper>
    );
  }
}

export default Card;

const CardWrapper = styled(AppComponentCard)<{columnSpan: number}>`
  height: 200px; /* Allow taller rows based on content */
  grid-column: auto / span ${p => p.columnSpan || 1};

  overflow-y: auto;
  overflow-x: hidden;
`;
