import React from 'react';

import Card from './index';
import {CardData} from '../types';
import {generateRandomId} from '../utils';

type DefaultProps = Pick<CardData, 'key' | 'columnSpan' | 'data'>;

type Props = Card['props'] & {
  addCard: (index: number, data: CardData) => void;
  resetLs: () => void;
  resetLsAll: () => void;
};

class CardAddNew extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    key: 'card-add-new',
    columnSpan: 1,
    data: {},
  };

  addCard = (columnSpan: CardData['columnSpan'] = 1) => {
    const {addCard, index} = this.props;

    addCard(index, {
      key: generateRandomId(),
      columnSpan,
      data: {},
    });
  };

  render() {
    return (
      <Card {...this.props} columnSpan={1} isRemovable={false}>
        ADD NEW:
        <div onClick={() => this.addCard(1)}>[click to add columnSpan=1]</div>
        <div onClick={() => this.addCard(2)}>[click to add columnSpan=2]</div>
        <div onClick={() => this.addCard(3)}>[click to add columnSpan=3]</div>
        <br />
        RESET STATE:
        <div onDoubleClick={() => this.props.resetLs()}>
          [double-click to reset LS for dashboard]
        </div>
        <div onDoubleClick={() => this.props.resetLsAll()}>
          [double-click to nuke LS for team page]
        </div>
      </Card>
    );
  }
}

export default CardAddNew;
