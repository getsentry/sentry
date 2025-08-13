import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import type {
  SpanBoundsType,
  SpanGeneratedBoundsType,
  VerticalMark,
} from 'sentry/components/events/interfaces/spans/utils';
import {parseTraceDetailsURLHash} from 'sentry/components/events/interfaces/spans/utils';
import WaterfallModel from 'sentry/components/events/interfaces/spans/waterfallModel';
import {MessageRow} from 'sentry/components/performance/waterfall/messageRow';
import {IconZoom} from 'sentry/icons/iconZoom';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {
  TraceError,
  TraceFullDetailed,
} from 'sentry/utils/performance/quickTrace/types';
import {
  isTraceError,
  isTraceTransaction,
} from 'sentry/utils/performance/quickTrace/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';

import type {EventDetail} from './newTraceDetailsContent';
import type {TraceInfo, TraceRoot, TreeDepth} from './types';

const TRANSACTION_BAR_HEIGHT = 24;

type Props = {
  addContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  continuingDepths: TreeDepth[];
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  hasGuideAnchor: boolean;
  index: number;
  isBarScrolledTo: boolean;
  isExpanded: boolean;
  isLast: boolean;
  isOrphan: boolean;
  isVisible: boolean;
  location: Location;
  onBarScrolledTo: () => void;
  onWheel: (deltaX: number) => void;
  organization: Organization;
  removeContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  toggleExpandedState: () => void;
  traceInfo: TraceInfo;
  traceViewRef: React.RefObject<HTMLDivElement | null>;
  transaction: TraceRoot | TraceFullDetailed | TraceError;
  barColor?: string;
  isOrphanError?: boolean;
  measurements?: Map<number, VerticalMark>;
  numOfOrphanErrors?: number;
  onRowClick?: (detailKey: EventDetail | undefined) => void;
  onlyOrphanErrors?: boolean;
};

function NewTraceDetailsTransactionBar(props: Props) {
  const hashValues = parseTraceDetailsURLHash(props.location.hash);
  const openPanel = decodeScalar(props.location.query.openPanel);
  const eventIDInQueryParam = !!(
    isTraceTransaction(props.transaction) &&
    hashValues?.eventId &&
    hashValues.eventId === props.transaction.event_id
  );
  const isHighlighted = !!(!hashValues?.spanId && eventIDInQueryParam);
  const highlightEmbeddedSpan = !!(hashValues?.spanId && eventIDInQueryParam);
  const [showEmbeddedChildren] = useState(isHighlighted || highlightEmbeddedSpan);
  const [isIntersecting, setIntersecting] = useState(false);
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
    const offset = boundingRect.top + window.scrollY - TRANSACTION_BAR_HEIGHT;
    window.scrollTo(0, offset);
    props.onBarScrolledTo();
  }, [transactionRowDOMRef, props]);

  useEffect(() => {
    const {transaction, isBarScrolledTo} = props;
    const observer = new IntersectionObserver(([entry]) =>
      setIntersecting(entry!.isIntersecting)
    );

    if (transactionRowDOMRef.current) {
      observer.observe(transactionRowDOMRef.current);
    }

    if (
      'event_id' in transaction &&
      hashValues?.eventId === transaction.event_id &&
      !isIntersecting &&
      !isBarScrolledTo
    ) {
      scrollIntoView();
    }

    if (isIntersecting) {
      props.onBarScrolledTo();
    }

    return () => {
      observer.disconnect();
    };
  }, [
    setIntersecting,
    hashValues?.eventId,
    hashValues?.spanId,
    props,
    scrollIntoView,
    isIntersecting,
    transactionRowDOMRef,
  ]);

  useEffect(() => {
    const transactionTitleRefCurrentCopy = transactionTitleRef.current;

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
  }, [handleWheel, props, transactionTitleRef]);

  const transactionEvent =
    isTraceTransaction<TraceFullDetailed>(props.transaction) ||
    isTraceError(props.transaction)
      ? props.transaction
      : undefined;
  const {
    data: embeddedChildren,
    isPending: isEmbeddedChildrenLoading,
    error: embeddedChildrenError,
  } = useApiQuery<EventTransaction>(
    [
      `/organizations/${props.organization.slug}/events/${transactionEvent?.project_slug}:${transactionEvent?.event_id}/`,
    ],
    {
      staleTime: 2 * 60 * 1000,
      enabled: showEmbeddedChildren || isHighlighted,
    }
  );

  const waterfallModel = useMemo(() => {
    return embeddedChildren
      ? new WaterfallModel(
          embeddedChildren,
          undefined,
          undefined,
          undefined,
          props.traceInfo
        )
      : null;
  }, [embeddedChildren, props.traceInfo]);

  useEffect(() => {
    if (isTraceTransaction(props.transaction) && !isTraceError(props.transaction)) {
      if (isHighlighted && props.onRowClick) {
        props.onRowClick({
          traceFullDetailedEvent: props.transaction,
          event: embeddedChildren,
          openPanel,
        });
      }
    }
  }, [isHighlighted, embeddedChildren, props, props.transaction, openPanel]);

  const renderEmbeddedChildrenState = () => {
    if (showEmbeddedChildren) {
      if (isEmbeddedChildrenLoading) {
        return (
          <MessageRow>
            <span>{t('Loading embedded transaction')}</span>
          </MessageRow>
        );
      }

      if (embeddedChildrenError) {
        return (
          <MessageRow>
            <span>{t('Error loading embedded transaction')}</span>
          </MessageRow>
        );
      }
    }

    return null;
  };

  const renderEmbeddedChildren = () => {
    if (!embeddedChildren || !showEmbeddedChildren || !waterfallModel) {
      return null;
    }

    const {isExpanded, toggleExpandedState} = props;

    if (isExpanded) {
      toggleExpandedState();
    }

    return null;
  };

  return (
    <div>
      {renderEmbeddedChildrenState()}
      {renderEmbeddedChildren()}
    </div>
  );
}

export default NewTraceDetailsTransactionBar;

export const StyledZoomIcon = styled(IconZoom)`
  position: absolute;
  left: -20px;
  top: 4px;
  height: 16px;
  width: 18px;
  z-index: 1000;
  background: ${p => p.theme.background};
  padding: 1px;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${space(0.5)};
`;
