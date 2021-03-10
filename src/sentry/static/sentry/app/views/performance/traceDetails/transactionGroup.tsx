import React from 'react';

import {TraceFull} from 'app/utils/performance/quickTrace/types';

import TransactionBar from './transactionBar';

type DefaultProps = {
  isLast: boolean;
  continuingDepths: Array<number>;
};

type Props = DefaultProps & {
  transaction: TraceFull;
};

type State = {
  isExpanded: boolean;
};

class TransactionGroup extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    isLast: true,
    continuingDepths: [],
  };

  state = {
    isExpanded: true,
  };

  toggleExpandedState = () => {
    this.setState(({isExpanded}) => ({isExpanded: !isExpanded}));
  };

  render() {
    const {continuingDepths, isLast, transaction} = this.props;
    const {isExpanded} = this.state;
    const {children} = transaction;

    return (
      <React.Fragment>
        <TransactionBar
          transaction={transaction}
          continuingDepths={continuingDepths}
          isLast={isLast}
          isExpanded={isExpanded}
          toggleExpandedState={this.toggleExpandedState}
        />
        {isExpanded &&
          children.map((child, index) => {
            const isLastChild = index === children.length - 1;
            const hasChildren = child.children.length > 0;

            const newContinuingDepths =
              !isLastChild && hasChildren
                ? [...continuingDepths, transaction.generation]
                : [...continuingDepths];

            return (
              <TransactionGroup
                key={child.event_id}
                transaction={child}
                isLast={isLastChild}
                continuingDepths={newContinuingDepths}
              />
            );
          })}
      </React.Fragment>
    );
  }
}

export default TransactionGroup;
