import {Component, Fragment} from 'react';
import type {Location} from 'history';

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
import type {TraceInfo, TraceRoot, TreeDepth} from './types';

type Props = {
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
  traceViewRef: React.RefObject<HTMLDivElement | null>;
  transaction: TraceRoot | TraceFullDetailed | TraceError;
  barColor?: string;
  isBarScrolledTo?: boolean;
  isOrphanError?: boolean;
  measurements?: Map<number, VerticalMark>;
  numOfOrphanErrors?: number;
  onBarScrolledTo?: () => void;
  onRowClick?: (detailKey: EventDetail | undefined) => void;
  onlyOrphanErrors?: boolean;
};

type State = {
  isExpanded: boolean;
};

class TransactionGroup extends Component<Props, State> {
  state: State = {
    isExpanded: true,
  };

  toggleExpandedState = () => {
    this.setState(({isExpanded}) => ({isExpanded: !isExpanded}));
  };

  render() {
    const {renderedChildren} = this.props;
    const {isExpanded} = this.state;

    return <Fragment>{isExpanded && renderedChildren}</Fragment>;
  }
}

export default TransactionGroup;
