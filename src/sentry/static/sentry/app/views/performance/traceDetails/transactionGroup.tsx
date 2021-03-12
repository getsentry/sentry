import React from 'react';

import {TraceFull} from 'app/utils/performance/quickTrace/types';

import TransactionBar from './transactionBar';
import {TraceInfo} from './types';

type DefaultProps = {
  index: number;
  isLast: boolean;
  continuingDepths: Array<number>;
};

type Props = DefaultProps & {
  transaction: TraceFull;
  traceInfo: TraceInfo;
};

type State = {
  isExpanded: boolean;
};

class TransactionGroup extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    index: 0,
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
    const {index, continuingDepths, isLast, transaction, traceInfo} = this.props;
    const {isExpanded} = this.state;
    const {children} = transaction;

    return (
      <React.Fragment>
        <TransactionBar
          index={index}
          transaction={transaction}
          traceInfo={traceInfo}
          continuingDepths={continuingDepths}
          isLast={isLast}
          isExpanded={isExpanded}
          toggleExpandedState={this.toggleExpandedState}
        />
        {isExpanded &&
          children.map((child, idx) => {
            const isLastChild = idx === children.length - 1;
            const hasChildren = child.children.length > 0;

            const newContinuingDepths =
              !isLastChild && hasChildren
                ? [...continuingDepths, transaction.generation]
                : [...continuingDepths];

            // TODO(tonyx): figure out the index
            return (
              <TransactionGroup
                key={child.event_id}
                transaction={child}
                traceInfo={traceInfo}
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
