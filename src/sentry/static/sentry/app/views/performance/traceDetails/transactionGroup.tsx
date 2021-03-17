import React from 'react';

import {TraceFull} from 'app/utils/performance/quickTrace/types';

import TransactionBar from './transactionBar';
import {TraceInfo} from './types';

type Props = {
  transaction: TraceFull;
  traceInfo: TraceInfo;
  continuingDepths: Array<number>;
  isLast: boolean;
  index: number;
  isVisible: boolean;
  renderedChildren: React.ReactNode[];
};

type State = {
  isExpanded: boolean;
};

class TransactionGroup extends React.Component<Props, State> {
  state = {
    isExpanded: true,
  };

  toggleExpandedState = () => {
    this.setState(({isExpanded}) => ({isExpanded: !isExpanded}));
  };

  render() {
    const {
      transaction,
      traceInfo,
      continuingDepths,
      isLast,
      index,
      isVisible,
      renderedChildren,
    } = this.props;
    const {isExpanded} = this.state;

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
          isVisible={isVisible}
        />
        {isExpanded && renderedChildren}
      </React.Fragment>
    );
  }
}

export default TransactionGroup;
