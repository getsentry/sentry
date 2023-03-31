import {Component, Fragment} from 'react';
import {Location} from 'history';

import {
  ScrollbarManagerChildrenProps,
  withScrollbarManager,
} from 'sentry/components/events/interfaces/spans/scrollbarManager';
import {
  SpanBoundsType,
  SpanGeneratedBoundsType,
  VerticalMark,
} from 'sentry/components/events/interfaces/spans/utils';
import {Organization} from 'sentry/types';
import {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';

import TransactionBar from './transactionBar';
import {TraceInfo, TraceRoot, TreeDepth} from './types';

type Props = ScrollbarManagerChildrenProps & {
  continuingDepths: TreeDepth[];
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  hasGuideAnchor: boolean;
  index: number;
  isLast: boolean;
  isOrphan: boolean;
  isVisible: boolean;
  location: Location;
  organization: Organization;
  renderedChildren: React.ReactNode[];
  traceInfo: TraceInfo;
  transaction: TraceRoot | TraceFullDetailed;
  barColor?: string;
  measurements?: Map<number, VerticalMark>;
};

type State = {
  isExpanded: boolean;
};

class TransactionGroup extends Component<Props, State> {
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
      addContentSpanBarRef,
      removeContentSpanBarRef,
      onWheel,
      measurements,
      generateBounds,
    } = this.props;
    const {isExpanded} = this.state;

    return (
      <Fragment>
        <TransactionBar
          location={location}
          organization={organization}
          measurements={measurements}
          generateBounds={generateBounds}
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
          addContentSpanBarRef={addContentSpanBarRef}
          removeContentSpanBarRef={removeContentSpanBarRef}
          onWheel={onWheel}
        />
        {isExpanded && renderedChildren}
      </Fragment>
    );
  }
}

export default withScrollbarManager(TransactionGroup);
