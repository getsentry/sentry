import React from 'react';

import IssueList from 'app/components/issueList';

import Card from './index';
import {CardData} from '../types';

type DefaultProps = Pick<CardData, 'key' | 'columnSpan' | 'data'>;

type Props = Card['props'] & {};

class CardIssueList extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    columnSpan: 2,
    data: {},
  };

  render() {
    return (
      <Card {...this.props} columnSpan={2} isRemovable={false}>
        <IssueList
          endpoint="/organizations/sentry/issues/new/"
          statsPeriod="24h"
          emptyText="No errors"
          showActions
          noBorder
          noMargin
          pagination={false}
        />
      </Card>
    );
  }
}

export default CardIssueList;
