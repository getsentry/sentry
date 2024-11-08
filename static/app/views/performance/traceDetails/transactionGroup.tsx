import {Component, Fragment} from 'react';
import type {Location} from 'history';

import type {SpanDetailProps} from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanDetails';
import type {ScrollbarManagerChildrenProps} from 'sentry/components/events/interfaces/spans/scrollbarManager';
import {withScrollbarManager} from 'sentry/components/events/interfaces/spans/scrollbarManager';
import type {
  SpanBoundsType,
  SpanGeneratedBoundsType,
  VerticalMark,
} from 'sentry/components/events/interfaces/spans/utils';
import type {Organization} from 'sentry/types/organization';
import type {
  TraceError,
  TraceFullDetailed,
} from 'sentry/utils/performance/quickTrace/types';

import type {EventDetail} from './newTraceDetailsContent';
import NewTraceDetailsTransactionBar from './newTraceDetailsTransactionBar';
import TransactionBar from './transactionBar';
import type {TraceInfo, TraceRoot, TreeDepth} from './types';

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
  traceViewRef: React.RefObject<HTMLDivElement>;
  transaction: TraceRoot | TraceFullDetailed | TraceError;
  barColor?: string;
  isBarScrolledTo?: boolean;
  isOrphanError?: boolean;
  measurements?: Map<number, VerticalMark>;
  numOfOrphanErrors?: number;
  onBarScrolledTo?: () => void;
  onRowClick?: (detailKey: EventDetail | SpanDetailProps | undefined) => void;
  onlyOrphanErrors?: boolean;
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
      numOfOrphanErrors,
      onlyOrphanErrors,
      isOrphanError,
      traceViewRef,
      onRowClick,
      onBarScrolledTo,
      isBarScrolledTo,
    } = this.props;
    const {isExpanded} = this.state;

    const commonProps = {
      location,
      organization,
      measurements,
      generateBounds,
      index,
      transaction,
      traceInfo,
      continuingDepths,
      isOrphan,
      isLast,
      isExpanded,
      toggleExpandedState: this.toggleExpandedState,
      isVisible,
      hasGuideAnchor,
      barColor,
      addContentSpanBarRef,
      removeContentSpanBarRef,
      onWheel,
      onlyOrphanErrors,
      numOfOrphanErrors,
      isOrphanError,
    };

    return (
      <Fragment>
        {organization.features.includes('performance-trace-details') &&
        onBarScrolledTo ? (
          <NewTraceDetailsTransactionBar
            {...commonProps}
            isBarScrolledTo={!!isBarScrolledTo}
            onBarScrolledTo={onBarScrolledTo}
            traceViewRef={traceViewRef}
            onRowClick={onRowClick}
          />
        ) : (
          <TransactionBar {...commonProps} />
        )}

        {isExpanded && renderedChildren}
      </Fragment>
    );
  }
}

export default withScrollbarManager(TransactionGroup);
