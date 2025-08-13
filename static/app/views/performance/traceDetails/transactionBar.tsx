import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import type {
  SpanBoundsType,
  SpanGeneratedBoundsType,
  VerticalMark,
} from 'sentry/components/events/interfaces/spans/utils';
import {transactionTargetHash} from 'sentry/components/events/interfaces/spans/utils';
import {Row, RowCellContainer} from 'sentry/components/performance/waterfall/row';
import type {Organization} from 'sentry/types/organization';
import type {
  TraceError,
  TraceFullDetailed,
} from 'sentry/utils/performance/quickTrace/types';
import {
  isTraceError,
  isTraceRoot,
  isTraceTransaction,
} from 'sentry/utils/performance/quickTrace/utils';

import TransactionDetail from './transactionDetail';
import type {TraceInfo, TraceRoot, TreeDepth} from './types';

type Props = {
  addContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  continuingDepths: TreeDepth[];
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  hasGuideAnchor: boolean;
  index: number;
  isExpanded: boolean;
  isLast: boolean;
  isOrphan: boolean;
  isVisible: boolean;
  location: Location;
  onWheel: (deltaX: number) => void;
  organization: Organization;
  removeContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  toggleExpandedState: () => void;
  traceInfo: TraceInfo;
  transaction: TraceRoot | TraceFullDetailed | TraceError;
  barColor?: string;
  isOrphanError?: boolean;
  measurements?: Map<number, VerticalMark>;
  numOfOrphanErrors?: number;
  onlyOrphanErrors?: boolean;
};

function TransactionBar(props: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const transactionRowDOMRef = useRef<HTMLDivElement>(null);
  const transactionTitleRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      // https://stackoverflow.com/q/57358640
      // https://github.com/facebook/react/issues/14856
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (Math.abs(event.deltaY) === Math.abs(event.deltaX)) {
        return;
      }

      const {onWheel} = props;
      onWheel(event.deltaX);
    },
    [props]
  );

  const scrollIntoView = useCallback(() => {
    const element = transactionRowDOMRef.current;
    if (!element) {
      return;
    }
    const boundingRect = element.getBoundingClientRect();
    const offset = boundingRect.top + window.scrollY;
    setShowDetail(true);
    window.scrollTo(0, offset);
  }, [transactionRowDOMRef]);

  useEffect(() => {
    const {location, transaction} = props;
    const transactionTitleRefCurrentCopy = transactionTitleRef.current;

    if (
      'event_id' in transaction &&
      transactionTargetHash(transaction.event_id) === location.hash
    ) {
      scrollIntoView();
    }

    if (transactionTitleRefCurrentCopy) {
      transactionTitleRefCurrentCopy.addEventListener('wheel', handleWheel, {
        passive: false,
      });
    }

    return () => {
      if (transactionTitleRefCurrentCopy) {
        transactionTitleRefCurrentCopy.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel, props, scrollIntoView, transactionTitleRef]);

  const renderDetail = () => {
    const {location, organization, isVisible, transaction} = props;

    if (isTraceError(transaction) || isTraceRoot(transaction)) {
      return null;
    }

    if (!isVisible || !showDetail) {
      return null;
    }

    return (
      <TransactionDetail
        location={location}
        organization={organization}
        transaction={transaction}
        scrollIntoView={scrollIntoView}
      />
    );
  };

  const {isVisible, transaction} = props;

  return (
    <StyledRow
      ref={transactionRowDOMRef}
      visible={isVisible}
      showBorder={showDetail}
      cursor={isTraceTransaction<TraceFullDetailed>(transaction) ? 'pointer' : 'default'}
    >
      {renderDetail()}
    </StyledRow>
  );
}

export default TransactionBar;

const StyledRow = styled(Row)`
  &,
  ${RowCellContainer} {
    overflow: visible;
  }
`;
