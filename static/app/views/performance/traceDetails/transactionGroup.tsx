import * as React from 'react';
import {Location} from 'history';

import {
  ScrollbarManagerChildrenProps,
  withScrollbarManager,
} from 'app/components/events/interfaces/spans/scrollbarManager';
import {Organization} from 'app/types';
import {TraceFullDetailed} from 'app/utils/performance/quickTrace/types';

import TransactionBar from './transactionBar';
import {TraceInfo, TraceRoot, TreeDepth} from './types';

type Props = ScrollbarManagerChildrenProps & {
  location: Location;
  organization: Organization;
  transaction: TraceRoot | TraceFullDetailed;
  traceInfo: TraceInfo;
  continuingDepths: TreeDepth[];
  isOrphan: boolean;
  isLast: boolean;
  index: number;
  isVisible: boolean;
  hasGuideAnchor: boolean;
  renderedChildren: React.ReactNode[];
  barColor?: string;
};

type State = {
  isExpanded: boolean;
};

class TransactionGroup extends React.Component<Props, State> {
  state: State = {
    isExpanded: true,
  };

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.isExpanded !== this.state.isExpanded) {
      this.props.updateScrollState();
    }
  }

  toggleExpandedState = () => {
    this.setState(({isExpanded}) => ({isExpanded: !isExpanded}));
  };

  render() {
    const {
      location,
      organization,
      transaction,
      traceInfo,
      continuingDepths,
      isOrphan,
      isLast,
      index,
      isVisible,
      hasGuideAnchor,
      renderedChildren,
      barColor,
    } = this.props;
    const {isExpanded} = this.state;

    return (
      <React.Fragment>
        <TransactionBar
          location={location}
          organization={organization}
          index={index}
          transaction={transaction}
          traceInfo={traceInfo}
          continuingDepths={continuingDepths}
          isOrphan={isOrphan}
          isLast={isLast}
          isExpanded={isExpanded}
          toggleExpandedState={this.toggleExpandedState}
          isVisible={isVisible}
          hasGuideAnchor={hasGuideAnchor}
          barColor={barColor}
        />
        {isExpanded && renderedChildren}
      </React.Fragment>
    );
  }
}

export default withScrollbarManager(TransactionGroup);
